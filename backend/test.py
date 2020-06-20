import argparse
import asyncio
import random
import json
import websockets

host = 'localhost:8080'

async def asyncrange(start, stop=None, step=1):
    if stop:
        range_ = range(start, stop, step)
    else:
        range_ = range(start)
    for i in range_:
        yield i
        await asyncio.sleep(0)

def random_id(length):
    number = '0123456789'
    alpha = 'abcdefghijklmnopqrstuvwxyz'
    id = ''
    for i in range(0,length,2):
        id += random.choice(number)
        id += random.choice(alpha)
    return id


async def send(websocket, event, data):
    print(websocket, event, data)
    await websocket.send(
        json.dumps(
            {'event': event,
             'data': data}))


async def joinPlayer(uri, gameId = None):
    headers = websockets.http.Headers()
    headers['Cookie'] = \
        'gameId=%s; ' % ('test_' + random_id(14)) +\
        'userId=%s; ' % ('test_' + random_id(14)) +\
        'sessionId=%s; ' % ('test_' + random_id(6)) +\
        'player_name=%s; ' % ('test_' + random_id(4))
    websocket = await websockets.connect(uri, extra_headers=headers)
    player = {
        'name': 'test_name_' + random_id(6),
    }
    if gameId is None:
            await websocket.send(
                json.dumps(
                    {'event':'gameCreated',
                     'data': {'game': {'wordsPerPlayer': C_NUM_WORDS_PER_PLAYER},
                              'player': player}}))
            data = await websocket.recv()
            gameId = json.loads(data)['data']['gameId']

    await send(websocket, 'playerJoined',
               {'gameId': gameId,
                'player': player})
    data = await websocket.recv()
    data = json.loads(data)
    while data['event'] != 'userIdHash':
        data = await websocket.recv()
        data = json.loads(data)
    userIdHash = data['data']['userIdHash']
    await send(websocket, 'putWordsInHat',
               {'gameId': gameId,
                'words': [random_id(32) for i in range(C_NUM_WORDS_PER_PLAYER)]})
    return (websocket, gameId, userIdHash)


async def hello(uri, i):
    await asyncio.sleep(i)
    playersConnections = {}
    websocket, gameId, userIdHash = await joinPlayer(uri)
    await send(websocket, 'putWordsInHat',
               {'gameId': gameId,
                'words': [random_id(32) for i in range(C_NUM_WORDS_PER_PLAYER)]})
    creatorUserIdHash = userIdHash
    playersConnections[userIdHash] = websocket
    for i in range(C_NUM_PLAYERS - 1):
        websocket, _, userIdHash = await joinPlayer(uri, gameId)
    playersConnections[userIdHash] = websocket
    await send(playersConnections[creatorUserIdHash], 'gameStarted', {'gameId': gameId})

    while True:
        roundNumber = None
        while roundNumber is None:
            data = await websocket.recv()
            data = json.loads(data)
            print(data)
            while data['event'] != 'gameUpdated':
                data = await websocket.recv()
                data = json.loads(data)
                print(data)
            roundNumber = data['data']['game']['roundNumber']
            explainPlayerId = data['data']['game']['explainPlayerId']
            guessPlayerId = data['data']['game']['guessPlayerId']
        if data['data']['game']['gameStateEnded']:
            break
        confirmData = {
            'roundNumber': roundNumber,
            'gameId': gameId}
        send(playersConnections[explainPlayerId], 'roundConfirmed', confirmData)
        send(playersConnections[guessPlayerId], 'roundConfirmed', confirmData)
        while True:
            data = await websocket.recv()
            print(data)
        for i in range(20):
            await asyncio.sleep(0.1)
            await send(playersConnections[explainPlayerId],
                       'wordGuessed', {'gameId': gameId})
        await send(playersConnections[explainPlayerId],
                   'roundComplete', {'gameId': gameId, 'lastWordResult': 'GUESSED'})



async def main():
    uri = "wss://onlinehat.xyz/wsapiv1"
    #uri = "ws://localhost:8080/wsapiv1"
    for f in asyncio.as_completed([hello(uri, i) for i in range(C_NUM_GAMES)]):
        result = await f
    print('Ended')

C_NUM_GAMES = 1
C_NUM_PLAYERS = 20
C_NUM_WORDS_PER_PLAYER = 40


if __name__ == "__main__":
    asyncio.run(main())
