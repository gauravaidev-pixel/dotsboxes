import eventlet
eventlet.monkey_patch()

import random
import string
import time
from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room, emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'dots-and-boxes-secret'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# In-memory room store. Fine for this game's scale — Render free tier
# also sleeps/restarts on redeploy, so nothing here needs to survive that.
# rooms[code] = {
#   size, lines: {"x,y,h": "S"}, boxes: {"x,y": "S"}, score: {S,G},
#   turn, names: {S,G}, sids: {S: sid, G: sid}, game_over, last_active
# }
rooms = {}

ROOM_CODE_CHARS = string.ascii_uppercase + string.digits


def make_room_code():
    while True:
        code = ''.join(random.choices(ROOM_CODE_CHARS, k=5))
        if code not in rooms:
            return code


def public_state(room):
    return {
        'size': room['size'],
        'lines': room['lines'],
        'boxes': room['boxes'],
        'score': room['score'],
        'turn': room['turn'],
        'names': room['names'],
        'colors': room['colors'],
        'last_move': room['last_move'],
        'game_over': room['game_over'],
        'connected': {k: v is not None for k, v in room['sids'].items()},
    }


def box_key(x, y):
    return f"{x},{y}"


def get_other_sid(room, sid):
    for role in ('S', 'G'):
        if room['sids'][role] == sid:
            other_role = 'G' if role == 'S' else 'S'
            return room['sids'][other_role]
    return None


def check_box(room, x, y, turn):
    size = room['size']
    if x < 0 or y < 0 or x >= size - 1 or y >= size - 1:
        return False
    top = f"{x},{y},h"
    bottom = f"{x},{y + 1},h"
    left = f"{x},{y},v"
    right = f"{x + 1},{y},v"
    if all(k in room['lines'] for k in (top, bottom, left, right)):
        key = box_key(x, y)
        if key not in room['boxes']:
            room['boxes'][key] = turn
            room['score'][turn] += 1
            return True
    return False


DEFAULT_COLORS = {'S': '#FF416C', 'G': '#2193B0'}
ALLOWED_COLORS = {'#FF416C', '#2193B0', '#27AE60', '#F4B400'}


def clean_color(value, fallback):
    if isinstance(value, str) and value.upper() in ALLOWED_COLORS:
        return value.upper()
    return fallback


@app.route('/')
def index():
    return render_template('index.html')


@socketio.on('create_room')
def on_create_room(data):
    name = (data.get('name') or 'Player 1').strip()[:14] or 'Player 1'
    size = int(data.get('size') or 6)
    size = max(4, min(10, size))
    color_s = clean_color(data.get('color'), DEFAULT_COLORS['S'])
    code = make_room_code()
    rooms[code] = {
        'size': size,
        'lines': {},
        'boxes': {},
        'score': {'S': 0, 'G': 0},
        'turn': 'S',
        'names': {'S': name, 'G': None},
        'colors': {'S': color_s, 'G': DEFAULT_COLORS['G']},
        'last_move': None,
        'sids': {'S': None, 'G': None},
        'game_over': False,
        'last_active': time.time(),
    }
    room = rooms[code]
    join_room(code)
    room['sids']['S'] = request.sid
    emit('room_created', {'code': code, 'role': 'S', 'state': public_state(room)})


@socketio.on('join_room_req')
def on_join_room(data):
    code = (data.get('code') or '').strip().upper()
    name = (data.get('name') or 'Player 2').strip()[:14] or 'Player 2'

    if code not in rooms:
        emit('join_error', {'message': 'Room not found. Double-check the code.'})
        return

    room = rooms[code]

    if room['sids']['G'] is not None and room['names']['G']:
        emit('join_error', {'message': 'This room is already full.'})
        return

    color_g = clean_color(data.get('color'), DEFAULT_COLORS['G'])
    if color_g == room['colors']['S']:
        # keep the two players visually distinct
        color_g = DEFAULT_COLORS['G'] if room['colors']['S'] != DEFAULT_COLORS['G'] else DEFAULT_COLORS['S']

    room['names']['G'] = name
    room['colors']['G'] = color_g
    room['sids']['G'] = request.sid
    room['last_active'] = time.time()
    join_room(code)

    emit('room_joined', {'code': code, 'role': 'G', 'state': public_state(room)})
    emit('opponent_joined', {'state': public_state(room)}, to=code, include_self=False)
    emit('game_start', {'state': public_state(room)}, to=code)


@socketio.on('make_move')
def on_make_move(data):
    code = (data.get('code') or '').strip().upper()
    x, y, ltype = data.get('x'), data.get('y'), data.get('type')

    room = rooms.get(code)
    if not room or room['game_over']:
        return

    # figure out which role this socket is
    role = None
    if room['sids']['S'] == request.sid:
        role = 'S'
    elif room['sids']['G'] == request.sid:
        role = 'G'
    if role is None or role != room['turn']:
        return  # not your turn / not in this room

    key = f"{x},{y},{ltype}"
    if key in room['lines']:
        return

    size = room['size']
    if ltype == 'h':
        if not (0 <= x < size - 1 and 0 <= y < size):
            return
    else:
        if not (0 <= x < size and 0 <= y < size - 1):
            return

    room['lines'][key] = room['turn']
    room['last_move'] = {'x': x, 'y': y, 'type': ltype, 'player': room['turn']}
    room['last_active'] = time.time()

    made_box = False
    turn = room['turn']
    if ltype == 'h':
        if y > 0:
            made_box = check_box(room, x, y - 1, turn) or made_box
        if y < size - 1:
            made_box = check_box(room, x, y, turn) or made_box
    else:
        if x > 0:
            made_box = check_box(room, x - 1, y, turn) or made_box
        if x < size - 1:
            made_box = check_box(room, x, y, turn) or made_box

    if not made_box:
        room['turn'] = 'G' if room['turn'] == 'S' else 'S'

    total_boxes = (size - 1) * (size - 1)
    if len(room['boxes']) >= total_boxes:
        room['game_over'] = True

    emit('state_update', {'state': public_state(room)}, to=code)


@socketio.on('leave_room_req')
def on_leave_room(data):
    code = (data.get('code') or '').strip().upper()
    room = rooms.get(code)
    if not room:
        return
    for role in ('S', 'G'):
        if room['sids'][role] == request.sid:
            room['sids'][role] = None
    leave_room(code)
    emit('opponent_left', {'state': public_state(room)}, to=code)


# ---------------------------------------------------------------------
# Voice chat signaling — the server only relays WebRTC handshake
# messages between the two sockets in a room. No audio ever passes
# through the server; once connected, voice flows peer-to-peer.
# ---------------------------------------------------------------------
def relay_to_opponent(data, event_name, payload):
    code = (data.get('code') or '').strip().upper()
    room = rooms.get(code)
    if not room:
        return
    other_sid = get_other_sid(room, request.sid)
    if other_sid:
        emit(event_name, payload, to=other_sid)


@socketio.on('voice_ready')
def on_voice_ready(data):
    relay_to_opponent(data, 'voice_ready', {})


@socketio.on('voice_offer')
def on_voice_offer(data):
    relay_to_opponent(data, 'voice_offer', {'sdp': data.get('sdp')})


@socketio.on('voice_answer')
def on_voice_answer(data):
    relay_to_opponent(data, 'voice_answer', {'sdp': data.get('sdp')})


@socketio.on('voice_ice')
def on_voice_ice(data):
    relay_to_opponent(data, 'voice_ice', {'candidate': data.get('candidate')})


@socketio.on('voice_leave')
def on_voice_leave(data):
    relay_to_opponent(data, 'voice_leave', {})


@socketio.on('disconnect')
def on_disconnect():
    for code, room in list(rooms.items()):
        for role in ('S', 'G'):
            if room['sids'][role] == request.sid:
                room['sids'][role] = None
                emit('opponent_left', {'state': public_state(room)}, to=code)


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
