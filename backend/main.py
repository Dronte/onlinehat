import asyncio
import pathlib
import ssl
import websockets
import datetime
import random
import json
import time
import uuid
import hashlib
import logging
import logging.handlers
import types
import sys
import traceback


# create logger with 'spam_application'
access_logger = logging.getLogger('access_log')
access_logger.setLevel(logging.DEBUG)
# create file handler which logs even debug messages
#fh = logging.StreamHandler()
fh = logging.handlers.TimedRotatingFileHandler('server_access.log', interval=10, when='M')
fh.setLevel(logging.DEBUG)
# create formatter and add it to the handlers
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - GameId:%(gameId)s - UserIdHash:%(userIdHash)s - sessionId:%(sessionId)s - %(message)s')
fh.setFormatter(formatter)
# add the handlers to the logger
access_logger.addHandler(fh)

# create logger with 'spam_application'
error_logger = logging.getLogger('error_log')
error_logger.setLevel(logging.DEBUG)
# create file handler which logs even debug messages
error_sh = logging.StreamHandler()
error_fh = logging.handlers.TimedRotatingFileHandler('server_error.log', interval=10, when='M')
fh.setLevel(logging.DEBUG)
# create formatter and add it to the handlers
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - GameId:%(gameId)s - UserIdHash:%(userIdHash)s - sessionId:%(sessionId)s - %(message)s')
error_fh.setFormatter(formatter)
error_sh.setFormatter(formatter)
# add the handlers to the logger
error_logger.addHandler(error_sh)
error_logger.addHandler(error_fh)


class Player:
    def __init__(self, connection, name, owner=False, userIdHash=None, putWordsInHat=False, observer=False):
        self.connection = connection
        self.userIdHash = connection.userIdHash
        self.name = name
        self.owner = owner
        self.putWordsInHat = putWordsInHat
        self.observer = observer
        self._results = {}

    def update(self, observer = None):
        if observer is not None:
            self.observer = observer

    def givePoint(self, pairUserIdHash, epochNumber, circleNumber, roundNumber, isExplain = False):
        if (epochNumber, circleNumber, roundNumber, isExplain) not in self._results:
            self._results[(epochNumber, circleNumber, roundNumber, isExplain)] = 0
        self._results[(epochNumber, circleNumber, roundNumber, isExplain)] += 1

    def toDict(self, gameEpochNumber, gameCircleNumber, gameRoundNumber):
        guessedByEpoch = 0
        explainedByEpoch = 0

        guessedByCircle = 0
        explainedByCircle = 0

        guessedTotal = 0
        explainedTotal = 0

        for key, value in self._results.items():
            epochNumber, circleNumber, roundNumber, isExplain = key
            if epochNumber < gameEpochNumber:
                if isExplain:
                    explainedByEpoch += value
                else:
                    guessedByEpoch += value
            if circleNumber < gameCircleNumber:
                if isExplain:
                    explainedByCircle += value
                else:
                    guessedByCircle += value

            if isExplain:
                explainedTotal += value
            else:
                guessedTotal += value


        return {
            'name': self.name,
            'userIdHash': self.userIdHash,
            'owner': self.owner,
            'observer': self.observer,
            'putWordsInHat': self.putWordsInHat,

            'guessedByEpoch': guessedByEpoch,
            'explainedByEpoch': explainedByEpoch,
            'guessedByCircle': guessedByCircle,
            'explainedByCircle': explainedByCircle,
            'guessedTotal': guessedTotal,
            'explainedTotal': explainedTotal
        }

# Word = collections.namedtuple('Word', '')

class Game:
    def __init__(self, gameId, wordsPerPlayer, ownerUserIdHash=None, gameMode=None, wordsMode=None):
        if gameMode is None:
            gameMode = 'CIRCLE'
        self.gameMode = gameMode
        self.wordsMode = wordsMode
        self.gameId = gameId
        self.players = {}
        self.wordsPerPlayer = wordsPerPlayer
        self.ownerUserIdHash = ownerUserIdHash
        self._playerWords = {}
        self.secondsPerRound = None

        self.gameStateTypingWords = False
        self.gameStatePlaying = False
        self.gameStateEnded = False

        self.roundNumber = None
        self.circleNumber = None
        self.epochNumber = None

        self.playersOrder = []
        self.observersOrder = []

        self.explainPlayerIndex = None
        self.guessPlayerIndex = None

        self._pairsOrder = []
        self._explainInPairPlayerIndex = 0
        self.pairIndex = None

        self.roundStateConfirmation = False
        self.roundStatePlaying = False

        self.explainPlayerConfirmed = None
        self.guessPlayerConfirmed = None
        self._wordsInHat = []

        self.initialWordsInHat = None

    def setSettings(self, secondsPerRound, gameMode, playersPairs=None, gameId=None, ownerIsObserver=None):
        self.secondsPerRound = secondsPerRound
        self.gameMode = gameMode
        self.playersPairs = playersPairs
        if ownerIsObserver:
            self.players[self.ownerUserIdHash].observer = True

    def getPlayerByConnection(self, connection):
        player =  self.players.get(connection.userIdHash)
        if not player:
            return None
        player.connection = connection
        return player

    def toDict(self):
        return {
            'wordsPerPlayer': self.wordsPerPlayer,
            'wordsMode': self.wordsMode,
            'ownerUserIdHash': self.ownerUserIdHash,
            'gameStateTypingWords': self.gameStateTypingWords,
            'gameStatePlaying': self.gameStatePlaying,
            'gameStateEnded': self.gameStateEnded,
            'playersOrder': self.playersOrder,
            'observersOrder': self.observersOrder,
            'explainPlayerId': None if self.explainPlayerIndex is None else self.playersOrder[self.explainPlayerIndex],
            'guessPlayerId': None if self.guessPlayerIndex is None else self.playersOrder[self.guessPlayerIndex],
            'explainPlayerConfirmed': self.explainPlayerConfirmed,
            'guessPlayerConfirmed': self.guessPlayerConfirmed,

            'secondsPerRound': self.secondsPerRound,

            'roundStateConfirmation': self.roundStateConfirmation,
            'roundStatePlaying': self.roundStatePlaying,

            'roundNumber': self.roundNumber,
            'circleNumber': self.circleNumber,
            'epochNumber': self.epochNumber,

            'initialWordsInHat': self.initialWordsInHat,
            'currentWordsInHat': len(self._wordsInHat),
        }

    def allPlayersDictsList(self):
        return [p.toDict(self.epochNumber, self.circleNumber, self.roundNumber) for p in self.players.values()]

    async def addPlayer(self, player):
        if self.ownerUserIdHash == player.userIdHash:
            player.owner = True
        else:
            if self.wordsMode == 'DICT':
                   player.putWordsInHat = True
        if player.userIdHash not in self.players:
            if self.gameStatePlaying or self.gameStateEnded:
                raise ValueError('You can not join to game')
            self.playersOrder.append(player.userIdHash)
        self.players[player.userIdHash] = player
        await self.notifyAllPlayers('playersUpdated',
                                    {'players': self.allPlayersDictsList(),
                                     'playersOrder': self.playersOrder})

    async def updatePlayer(self, player):
        self.players[player.userIdHash] = player
        await self.notifyAllPlayers('playersUpdated',
                                    {'players':[player.toDict(self.epochNumber, self.circleNumber, self.roundNumber)],
                                     'playersOrder': self.playersOrder})

    async def updateAllPlayers(self, player):
        await player.connection.send(
            'playersUpdated',
            {'players':
                 self.allPlayersDictsList(),
             'playersOrder': self.playersOrder},
            self.gameId)


    async def notifyAllPlayers(self, method, data):
        for player in self.players.values():
            await player.connection.send(method,
                                         data,
                                         self.gameId)


    async def removePlayer(self, playerIdHash):
        player = self.players[playerIdHash]
        self.players.pop(playerIdHash)
        if playerIdHash in self.playersOrder:
            self.playersOrder.remove(playerIdHash)
        if playerIdHash in self.observersOrder:
            self.observersOrder.remove(playerIdHash)
        if playerIdHash in self._playerWords:
            self._playerWords.pop(playerIdHash)

        await self.notifyAllPlayers('playersUpdated',
                                    {'players': self.allPlayersDictsList(),
                                     'playersOrder': self.playersOrder})
        await player.connection.send('playerRemoved', {}, self.gameId)


    async def startGame(self):
        self._prepareGame()
        await self.notifyAllPlayers('gameUpdated', {'game': self.toDict()})


    def _prepareGame(self):
        if self.gameMode == 'CIRCLE':
            self.playersOrder = [p.userIdHash for p in self.players.values() if not p.observer]
            self.observersOrder = [p.userIdHash for p in self.players.values() if p.observer]
            random.shuffle(self.playersOrder)
        elif self.gameMode == 'RANDOM_PAIRS':
            self.playersOrder = [p.userIdHash for p in self.players.values() if not p.observer]
            self.observersOrder = [p.userIdHash for p in self.players.values() if p.observer]
            random.shuffle(self.playersOrder)
            self._pairs = [(i, i+1) for i in range(0, len(self.playersOrder), 2)]
        elif self.gameMode == 'ASSIGNED_PAIRS':
            self.playersOrder = []
            for x in self.playersPairs:
                self.playersOrder.extend(x)
            self.observersOrder = [p.userIdHash for p in self.players.values() if p.userIdHash not in self.playersPairs]
            self._pairs = [(i, i+1) for i in range(0, len(self.playersOrder), 2)]
        else:
            raise ValueError('Unknown mode: ', self.gameMode)
        allWords = []
        for wordset in self._playerWords.values():
            allWords.extend(wordset)
        hatSize = (len(self.playersOrder) * self.wordsPerPlayer)
        while len(self._wordsInHat) < hatSize and len(allWords) > 0:
            random.shuffle(allWords)
            self._wordsInHat += allWords
        self._wordsInHat = self._wordsInHat[:hatSize]
        self.initialWordsInHat = len(self._wordsInHat)
        self.gameStateTypingWords = False
        self.gameStatePlaying = True


    async def startRound(self):
        random.shuffle(self._wordsInHat)
        if self.gameMode == 'CIRCLE':
            if self.explainPlayerIndex is None:
                self.explainPlayerIndex = -1

            if self.guessPlayerIndex is None:
                self.guessPlayerIndex = -1

            if self.roundNumber is None:
                self.roundNumber = -1
                self.circleNumber = -1
                self.epochNumber = 0
            self.roundNumber += 1
            self.explainPlayerIndex = (self.explainPlayerIndex + 1) % len(self.playersOrder)
            if self.explainPlayerIndex == 0:
                self.circleNumber += 1
                self.guessPlayerIndex = (self.guessPlayerIndex + 2) % len(self.playersOrder)
                if self.guessPlayerIndex == 0:
                    self.guessPlayerIndex += 1
                    self.epochNumber += 1
            else:
                self.guessPlayerIndex = (self.guessPlayerIndex + 1) % len(self.playersOrder)

        elif self.gameMode == 'RANDOM_PAIRS' or self.gameMode == 'ASSIGNED_PAIRS':
            if self.roundNumber is None:
                self.roundNumber = -1
                self.circleNumber = 0
                self.epochNumber = 0
            if self.pairIndex is None:
                self.pairIndex = -1

            self.roundNumber += 1
            self.pairIndex += 1
            if self.pairIndex >= len(self._pairs):
                self.pairIndex = 0
                if self.circleNumber % 2 == 1:
                    self.epochNumber += 1
                self.circleNumber += 1
                self._explainInPairPlayerIndex = 1 - self._explainInPairPlayerIndex
            pair = self._pairs[self.pairIndex]
            self.explainPlayerIndex = pair[self._explainInPairPlayerIndex]
            self.guessPlayerIndex = pair[1 - self._explainInPairPlayerIndex]

        self.roundStateConfirmation = True
        self.roundStatePlaying = False

        self.explainPlayerConfirmed = False
        self.guessPlayerConfirmed = False
        await self.notifyAllPlayers('gameUpdated', {'game':self.toDict()})


    async def confirmRound(self, player, data):
        if data['roundNumber'] == self.roundNumber:
            if player.userIdHash == self.playersOrder[self.guessPlayerIndex]:
                self.guessPlayerConfirmed = True

            if player.userIdHash == self.playersOrder[self.explainPlayerIndex]:
                self.explainPlayerConfirmed = True

            if self.guessPlayerConfirmed and self.explainPlayerConfirmed:
                self.roundStateConfirmation = False
                self.roundStatePlaying = True
                await self.giveNextWord()
            else:
                await player.connection.send('gameUpdated',
                                             {'game': self.toDict()},
                                             self.gameId)
        else:
            await player.connection.send('gameUpdated',
                                         {'game': self.toDict()},
                                         self.gameId)


    async def replayPreviousRound(self):
        if self.gameMode == 'CIRCLE':
            if self.explainPlayerIndex is None:
                self.explainPlayerIndex = -1

            if self.guessPlayerIndex is None:
                self.guessPlayerIndex = -1

            if self.roundNumber is None:
                self.roundNumber = -1
                self.circleNumber = -1
                self.epochNumber = 0
            self.roundNumber -= 1
            self.explainPlayerIndex = (self.explainPlayerIndex - 1) % len(self.playersOrder)
            if self.explainPlayerIndex == len(self.playersOrder) - 1:
                self.circleNumber -= 1
                self.guessPlayerIndex = (self.guessPlayerIndex - 2) % len(self.playersOrder)
                if self.guessPlayerIndex == len(self.playersOrder)-1:
                    self.guessPlayerIndex -= 1
                    self.epochNumber -= 1
            else:
                self.guessPlayerIndex = (self.guessPlayerIndex - 1) % len(self.playersOrder)

        elif self.gameMode == 'RANDOM_PAIRS' or self.gameMode == 'ASSIGNED_PAIRS':
            self.roundNumber -= 1
            self.pairIndex -= 1
            if self.pairIndex < 0:
                self.pairIndex = len(self._pairs) - 1
                self.circleNumber -= 1
                if self.circleNumber % 2 == 1:
                    self.epochNumber -= 1
                self._explainInPairPlayerIndex = 1 - self._explainInPairPlayerIndex
            pair = self._pairs[self.pairIndex]
            self.explainPlayerIndex = pair[self._explainInPairPlayerIndex]
            self.guessPlayerIndex = pair[1 - self._explainInPairPlayerIndex]

        self.roundStateConfirmation = True
        self.roundStatePlaying = False

        self.explainPlayerConfirmed = False
        self.guessPlayerConfirmed = False
        await self.notifyAllPlayers('gameUpdated', {'game':self.toDict()})


    async def giveNextWord(self):
        if len(self._wordsInHat) == 0:
            self.gameStatePlaying = False
            self.gameStateEnded = True

            self.roundStateConfirmation = False
            self.roundStatePlaying = False

            await self.notifyAllPlayers('gameUpdated', {'game':self.toDict()})
            await self.notifyAllPlayers('playersUpdated', {'players': self.allPlayersDictsList() })
        else:
            explainPlayer = self.players[self.playersOrder[self.explainPlayerIndex]]
            guessPlayer = self.players[self.playersOrder[self.guessPlayerIndex]]
            await explainPlayer.connection.send('nextWord', {'word': self._wordsInHat[0]}, self.gameId)
            for player in self.players.values():
                if player.userIdHash != explainPlayer.userIdHash:
                    await player.connection.send('nextWord', {'word': None}, self.gameId)


    def addWords(self, userIdHash, words, dictionary=None):
        if dictionary is None:
            self._playerWords[userIdHash] = words
        else:
            self._playerWords[userIdHash] = DICTS[dictionary]


    def wordGuessed(self, doCount = True):
        self._wordsInHat = self._wordsInHat[1:]
        if doCount:
            self.players[self.playersOrder[self.explainPlayerIndex]].givePoint(None,
                                                                               self.epochNumber,
                                                                               self.circleNumber,
                                                                               self.roundNumber,
                                                                               isExplain = True)
            self.players[self.playersOrder[self.guessPlayerIndex]].givePoint(None,
                                                                             self.epochNumber,
                                                                             self.circleNumber,
                                                                             self.roundNumber,
                                                                             isExplain = False)


DICTS = {}

class GameStorage:
    pass


GAME_STORAGE = {}

async def gameCreated(connection, data):
    gameId = str(uuid.uuid4())
    player = Player(connection, **data['player'], owner=True)
    game = Game(gameId, **data['game'],
                ownerUserIdHash = player.userIdHash)
    game.gameStateTypingWords = True
    GAME_STORAGE[gameId] = game
    await connection.send('gameCreated',
                          {'gameId':gameId},
                          gameId)
    #await game.addPlayer(player)


class NoSuchGame(ValueError):
    pass

async def playerJoined(connection, data):
    gameId = data['gameId']
    if gameId not in GAME_STORAGE:
        raise NoSuchGame(gameId)
    game = GAME_STORAGE.get(gameId)
    player = game.getPlayerByConnection(connection)
    if not player:
        player = Player(connection, **data['player'])
    await connection.send('userIdHash',
                          {'userIdHash': player.userIdHash,
                               'gameId': gameId},
                          gameId)
    await game.addPlayer(player)
    await connection.send('gameUpdated', {'game': game.toDict()}, gameId)
    if game.roundStatePlaying and game.playersOrder[game.explainPlayerIndex] == player.userIdHash:
        await game.giveNextWord()
    # FIXME: if player explains the word now?


async def playerUpdated(connection, data):
    gameId = data['gameId']
    if gameId not in GAME_STORAGE:
        raise NoSuchGame(gameId)
    game = GAME_STORAGE.get(gameId)
    player = game.getPlayerByConnection(connection)
    player.update(**data['player'])
    await connection.send('playersUpdated', {'players': game.allPlayersDictsList() }, gameId)


async def putWordsInHat(connection, data):
    gameId = data['gameId']
    game = GAME_STORAGE.get(gameId)
    game.addWords(connection.userIdHash, data['words'], data['dictionary'])
    player = game.getPlayerByConnection(connection)
    player.putWordsInHat = True
    await game.updatePlayer(player)


async def gameStarted(connection, data):
    gameId = data['gameId']
    game = GAME_STORAGE.get(gameId)
    game.setSettings(**data)
    await game.startGame()
    await game.startRound()


async def roundConfirmed(connection, data):
    gameId = data['gameId']
    game = GAME_STORAGE.get(gameId)
    player = game.getPlayerByConnection(connection)
    await game.confirmRound(player, data)


async def wordGuessed(connection, data):
    gameId = data['gameId']
    game = GAME_STORAGE.get(gameId)
    player = game.getPlayerByConnection(connection)
    game.wordGuessed()
    await game.giveNextWord()


async def roundComplete(connection, data):
    gameId = data['gameId']
    game = GAME_STORAGE.get(gameId)
    if data['lastWordResult'] == 'GUESSED':
        game.wordGuessed()
    elif data['lastWordResult'] == 'ERROR':
        game.wordGuessed(False)
    elif data['lastWordResult'] == 'NOT_GUESSED':
        pass
    else:
        raise Exception(data)
    await game.notifyAllPlayers('playersUpdated', {'players': game.allPlayersDictsList() })
    await game.startRound()


async def removePlayer(connection, data):
    gameId = data['gameId']
    game = GAME_STORAGE.get(gameId)
    await game.removePlayer(data['playerToRemoveId'])


async def replayPreviousRound(connection, data):
    gameId = data['gameId']
    game = GAME_STORAGE.get(gameId)
    if game.roundNumber != data['roundNumber']:
        raise ValueError('Attempt to replay round: ' + str(data['roundNumber']) + 'actual round:' + str(game.roundNumber))
    await game.replayPreviousRound()


C_EVENT_HANDLERS = {
    'gameCreated': gameCreated,
    'gameStarted': gameStarted,

    'playerUpdated': playerUpdated,
    'playerJoined': playerJoined,
    'putWordsInHat': putWordsInHat,

    'roundConfirmed': roundConfirmed,
    'wordGuessed': wordGuessed,
    'roundComplete': roundComplete,
    'removePlayer': removePlayer,
    'replayPreviousRound': replayPreviousRound
}


async def consumer(connection, message):
    try:
        message = json.loads(message)
        event = message['event']
        data = message['data']
        extra = {
            'userIdHash': connection.userIdHash,
            'sessionId': connection.sessionId,
            'gameId': data.get('gameId')
        }
        access_logger.info('recieved event:%s data:%s', event, json.dumps(data), extra=extra)
        await C_EVENT_HANDLERS[event](connection, data)
    except Exception as e:
        extype, ex, tb = sys.exc_info()
        formatted = traceback.format_exception_only(extype, ex)[-1].strip()
        error_logger.exception('exception:%s data:%s', formatted, message, extra=extra)


async def consumer_handler(connection):
    try:
        async for message in connection.websocket:
            await consumer(connection, message)
    except websockets.exceptions.ConnectionClosedError:
        print('consumer_handler connection closed error')
    except websockets.exceptions.ConnectionClosedOK:
        print('consumer_handler connection closed ok')


class Connection:
    def __init__(self, websocket, userId, sessionId, path):
        self.websocket = websocket
        self.userId = userId
        self.userIdHash = hashlib.sha1(self.userId.encode()).hexdigest()
        self.sessionId = sessionId
        self.path = path
        extra = {
            'userIdHash': self.userIdHash,
            'sessionId': self.sessionId,
            'gameId': None
        }
        access_logger.info('client connected', extra=extra)

    async def send(self, event, data, gameId):
        extra = {
            'userIdHash': self.userIdHash,
            'sessionId': self.sessionId,
            'gameId': gameId
        }
        access_logger.info('sending event:%s data:%s', event, json.dumps(data), extra=extra)
        try:
            await self.websocket.send(
                json.dumps({'event': event,
                            'data': data}))
        except websockets.exceptions.ConnectionClosedError:
            access_logger.info('send connection closed error', extra=extra)
        except websockets.exceptions.ConnectionClosedOK:
            access_logger.info('send connection closed ok', extra=extra)


def random_id(length):
    number = '0123456789'
    alpha = 'abcdefghijklmnopqrstuvwxyz'
    id = ''
    for i in range(0,length,2):
        id += random.choice(number)
        id += random.choice(alpha)
    return id


async def server(websocket, path):
    try:
        cookies = websocket.request_headers["cookie"].split()
        userId = None
        sessionId = None
        for cookie in cookies:
            if cookie.split('=')[0] == 'userId':
                userId = cookie.split('=')[1]
            if cookie.split('=')[0] == 'sessionId':
                sessionId = cookie.split('=')[1]
        if not userId.endswith(';'):
            userId += ';'
        if not sessionId.endswith(';'):
            sessionId += ';'
    except KeyError:
        raise ValueError('user without cookie connected')

    connection = Connection(websocket, userId, sessionId, path)
    consumer_task = asyncio.ensure_future(consumer_handler(connection))
    done, pending = await asyncio.wait(
        [consumer_task],
        return_when=asyncio.FIRST_COMPLETED,
    )
    for task in pending:
        task.cancel()


if __name__ == '__main__':
    for dict_name in ['simple', 'medium', 'hard']:
        words = []
        with open('dicts/%s.txt' % dict_name) as infile:
            for line in infile:
                line = line.strip()
                if line != '':
                    words.append(line)
        DICTS[dict_name] = words

    start_server = websockets.serve(
        server, "localhost", 8080#, ssl=ssl_context
    )

    asyncio.get_event_loop().run_until_complete(start_server)
    asyncio.get_event_loop().run_forever()

