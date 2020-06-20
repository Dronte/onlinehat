from main import *
import pytest


class MockConnection:
    def __init__(self, userIdHash):
        self.userIdHash = userIdHash

    async def send(*args, **kwargs):
        pass


def relevantPartOfGameDict(gameDict):
    return {x:gameDict[x] for x in [
        'explainPlayerId',
        'guessPlayerId',
        'explainPlayerConfirmed',
        'guessPlayerConfirmed',

        'roundStateConfirmation',
        'roundStatePlaying',

        'roundNumber',
        'circleNumber',
        'epochNumber']}


@pytest.mark.asyncio
@pytest.mark.parametrize("C_NUM_PLAYERS", [2,3,4,5,6,7,8,9,10])
@pytest.mark.parametrize("C_GAME_MODE", ['CIRCLE', 'RANDOM_PAIRS'])
async def test_replay_round(C_NUM_PLAYERS, C_GAME_MODE):
    if C_GAME_MODE == 'RANDOM_PAIRS' and C_NUM_PLAYERS % 2 == 1:
        return

    game = Game('test', C_NUM_PLAYERS, gameMode=C_GAME_MODE)
    for playerIndex in range(C_NUM_PLAYERS):
        player = Player(MockConnection(str(playerIndex)), 'player_%d' % playerIndex)
        await game.addPlayer(player)
        game.addWords(str(playerIndex), [str(i) for i in range(10)])

    await game.startGame()
    rounds = []
    C_NUM_ROUNDS = 1000
    for roundNuber in range(C_NUM_ROUNDS):
        await game.startRound()
        rounds.append(relevantPartOfGameDict(game.toDict()))

    afterRounds = []
    for roundNuber in range(C_NUM_ROUNDS):
        afterRounds.append(relevantPartOfGameDict(game.toDict()))
        assert relevantPartOfGameDict(game.toDict()) == rounds[C_NUM_ROUNDS - roundNuber - 1]
        await game.replayPreviousRound()

    assert rounds == afterRounds[::-1]
