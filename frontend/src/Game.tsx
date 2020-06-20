import * as React from 'react';
import WordsTypingList from './WordsTypingList';
import DictTypingForm from './DictTypingForm';
import {PlayerList} from './PlayerList';
import {IPlayer} from './Player';
import Timer from './Timer';
import PairSelectionForm from './PairSelectionForm';

import theme from './assets/react-toolbox/theme'
import './assets/react-toolbox/theme.css'
import ThemeProvider from 'react-toolbox/lib/ThemeProvider';

import Button from 'react-toolbox/lib/button/Button';
import Slider from 'react-toolbox/lib/slider/Slider';
import Checkbox from 'react-toolbox/lib/checkbox/Checkbox';
import Tooltip from 'react-toolbox/lib/tooltip';

import Tab from 'react-toolbox/lib/tabs/Tab';
import Tabs from 'react-toolbox/lib/tabs/Tabs';

import Cookies from 'js-cookie';

import Clipboard from 'clipboard';

import './App.css';
import './Game.css';

const TooltipButton = Tooltip(Button);

interface IProps {
    creatorName: string;
    wordsPerPlayer: number;
    gameId?: string;
    initialized: boolean;
    wordsMode?: string;
    playerRemoved: () => void;
}

interface IState {
    host: string;
    gameId?: string;
    initialized: boolean;
    players: Map<string, IPlayer>;
    playersOrder: Array<string>;
    observersOrder: Array<string>;
    playersPairs: Array<[string, string]>;
    wordsPerPlayer: number;
    wordsMode?: string;
    me: IPlayer;

    secondsPerRound: number;

    userId: string;
    sessionId: string;

    gameStateTypingWords: boolean;
    gameStatePlaying: boolean;
    gameStateEnded: boolean;

    roundStateConfirmation: boolean;
    roundStatePlaying: boolean;
    roundStateFinishing: boolean;
    roundNumber: number;
    circleNumber: number;
    epochNumber: number;

    myRound: boolean;
    explainPlayerId: string;
    guessPlayerId: string;
    explainPlayerConfirmed?: boolean;
    guessPlayerConfirmed?: boolean;

    initialWordsInHat: number;
    currentWordsInHat: number;

    wordToExplain?: string;

    buttonsDisabled: boolean;
    gameModeIndex: number;

    playersPairsKay: number;
}


function unwrap<T> (value: T | undefined | null, errorMessage?: string): T {
    if (value === null || value === undefined) {
        throw new Error(errorMessage || 'Missing value')
    } else {
        return value
    }
}


function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function makeid(length: number) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}


function isDefined(value: any) {
    return !(
        value === undefined  || value === null
    );
}

const sleep = (ms : number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

class Game extends React.Component<IProps, IState> {
    eventHandlers : Map<string, any>;

    constructor(props: IProps) {
        super(props);
        let gameIdUnknown = true;
        if (this.props.gameId) {
            gameIdUnknown = false;
        }

        let userId = Cookies.get('userId');
        if (!userId || userId === 'undefined') {
            userId = makeid(64);
        }
        const sessionId = makeid(32);

        this.state = {players : new Map<string, IPlayer>(),
                      playersOrder: [],
                      observersOrder: [],
                      playersPairs: [],
                      host: this.getHost(),
                      gameId: props.gameId,
                      sessionId: sessionId,
                      userId: userId,
                      initialized: false,
                      wordsPerPlayer: props.wordsPerPlayer,
                      wordsMode: props.wordsMode,
                      secondsPerRound: 22,
                      me: {name: props.creatorName,
                           observer: false,
                           owner: gameIdUnknown},
                      gameStateTypingWords: false,
                      gameStatePlaying: false,
                      gameStateEnded: false,
                      myRound: false,
                      explainPlayerId: '',
                      guessPlayerId: '',
                      explainPlayerConfirmed: undefined,
                      guessPlayerConfirmed: undefined,

                      roundStateConfirmation: false,
                      roundStatePlaying: false,
                      roundStateFinishing: false,
                      roundNumber: -1,
                      circleNumber: -1,
                      epochNumber: -1,
                      wordToExplain: undefined,
                      buttonsDisabled: false,
                      gameModeIndex: 0,
                      playersPairsKay: 0,

                      initialWordsInHat: 0,
                      currentWordsInHat: 0
                      };
        this.eventHandlers = new Map();
        this.eventHandlers.set('userIdHash', this.userIdHashHandler);
        this.eventHandlers.set('playersUpdated', this.playersUpdatedHandler);
        this.eventHandlers.set('gameCreated', this.gameCreatedHandler);
        this.eventHandlers.set('gameUpdated', this.gameUpdatedHandler);

        this.eventHandlers.set('nextWord', this.nextWordHandler);
        this.eventHandlers.set('playerRemoved', this.props.playerRemoved);

        this.ws = new WebSocket('wss://example.com/devnull');
        this.reconnectDelay = 10;
    };

    ws : WebSocket;
    reconnectDelay: number;

    private getHost = () => {
        var protocol = window.location.protocol;
        var port = window.location.port;
        var slashes = protocol.concat("//");
        var host = slashes.concat(window.location.hostname);
        if (port) {
            host = host.concat(":").concat(port.toString());
        }
        return host;
    }

    private getHostWithoutProtocol = () => {
        var port = window.location.port;
        var host = window.location.hostname;
        if (host === 'localhost') {
            return 'ws://localhost:8080';
        }
        if (host === '127.0.0.1') {
            return 'ws://127.0.0.1:8080';
        }
        if (port) {
            host = host.concat(":").concat(port.toString());
        }
        return 'wss://' + host;
    }

    private async setupWS() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.getHostWithoutProtocol() + '/wsapiv1');

            this.ws.onopen = () => {
                // on connecting, do nothing but log it to the console
                console.log('connected')
                resolve();
            }

            this.ws.onmessage = evt => {
                // listen to data sent from the websocket server
                // const message = JSON.parse();
                // this.setState({: message})
                console.log(evt.data);
                if (this.reconnectDelay > 10) {
                    this.reconnectDelay /= 1.05;
                }
                this.handleEvent(evt);
            }

            this.ws.onclose = () => {
                console.log('disconnected, delay=', this.reconnectDelay);
                this.reconnectDelay *= 1.2;
                sleep(this.reconnectDelay).then(() => {this.reconnect()}); // sleep
            }

            this.ws.onerror = () => {
                console.log('ws error, delay=', this.reconnectDelay);
            }
            console.log('setupWsCompleted');
        });
    }

    private sendEvent(event: string, data: any) {
         if (this.state.gameId) {
             data['gameId'] = this.state.gameId;
         }
         let sendCallback = () => {
             console.log('senging', event, data );
             this.ws.send(
                 JSON.stringify(
                     {'event': event,
                      'data': data}));
         };
         let waitForConnection = (sleepduration: number) => {
             if (this.ws.readyState === 1) { // Connected
                 sendCallback()
             } else {
                 console.log('fallback');
                 sleep(sleepduration).then(() => {waitForConnection(sleepduration * 1.2)});
             }
         }
         waitForConnection(50);
    }

    private thisPlayerJoined() {
        const creator: IPlayer = {
            name : this.props.creatorName,
            observer: this.state.me.observer,
            owner : false
        };
        this.sendEvent('playerJoined',
                       {'player': creator,
                        'gameId': this.state.gameId});
    }

    private reconnect() {
        this.setupWS().then(() => {
            console.log('reconnected, gameId = ', this.state.gameId)
            if (this.state.gameId) {
                this.thisPlayerJoined();
            } else {
                const creator: IPlayer = {
                    name : this.props.creatorName,
                };
                this.sendEvent('gameCreated', {'player': creator,
                                               'game': {
                                                   'wordsPerPlayer': this.state.wordsPerPlayer,
                                                   'wordsMode': this.state.wordsMode}});
            }});
    }

    gameLinkClipboard?: Clipboard;
    public componentDidMount() {
        Cookies.set('sessionId', this.state.sessionId, {expires: 128, path: '/'});
        Cookies.set('userId', this.state.userId, {expires: 128, path: '/'});
        Cookies.set('playerName', this.state.me.name, {expires: 128, path: '/'})
        if (this.state.gameId) {
            Cookies.set('gameId', unwrap(this.props.gameId), {expires: 128, path: '/'})
        }
        this.reconnect();
        this.gameLinkClipboard = new Clipboard('#CopyButton');
    }

    private handleEvent = (evt: any) => {
        const data = JSON.parse(evt.data);
        const event : any = data["event"];
        this.eventHandlers.get(event)(data['data']);
    }

    private userIdHashHandler = (data: any) => {
        let myUserIdHash = data['userIdHash'];
        this.setState((prevState) => {
            let me = prevState.me;
            prevState.players.forEach(
                (player : IPlayer) => {
                    if (player.userIdHash === myUserIdHash) {
                        me = player;
                    }});
           me.userIdHash = myUserIdHash;
           return {me: me};
        });
    }

    private playerUpdatedSubHandler = (prevState: IState, data : IPlayer) => {
        if (data['userIdHash'] === prevState.me.userIdHash) {
            prevState.me = data;
        }
        prevState.players.set(unwrap(data['userIdHash']), data);
        return prevState;
    }

    private playersUpdatedHandler = (data : any) => {
        this.setState((prevState) => {
            data['players'].forEach((player : IPlayer) => {
                prevState = this.playerUpdatedSubHandler(prevState, player);
            });
            if (isDefined(data['playersOrder'])) {
                let playersOrder = data['playersOrder'].filter(
                    (userIdHash: string) => {return prevState.players.has(userIdHash)} );
                Array.from(prevState.players.keys()).forEach( (key) =>{
                    if (playersOrder.indexOf(key) == -1) {
                        prevState.players.delete(key);
                    }
                });
                prevState = {...prevState,
                             playersOrder: playersOrder};
            }
            return prevState;
        });
    }

    private gameCreatedHandler = (data : any) => {
        window.history.pushState("", "Hat Game!", "/game/" + data['gameId']);
        console.log('seting gameId cookie', data['gameId']);
        console.log('setting gameId ', 
            Cookies.set('gameId', data['gameId'], {expires: 128, path: '/'})
            );
        console.log('getting gameId ', 
            Cookies.get('gameId'));
        this.setState(prevState => ({
            gameId: data['gameId']
        }))
        this.thisPlayerJoined();
    }


    private gameUpdatedHandler = (data: any) => {
        console.log('gameUpdated', data)
        this.setState((prevStateUnmodifyable) => {
            let prevState = {...prevStateUnmodifyable};
            prevState.initialized = true;
            if (isDefined(data['game']['wordsPerPlayer'])) {
                prevState.wordsPerPlayer = data['game']['wordsPerPlayer'];
            }
            if (isDefined(data['game']['secondsPerRound'])) {
                prevState.secondsPerRound = data['game']['secondsPerRound'];
            }
            if (isDefined(data['game']['gameStateTypingWords'])) {
                prevState.gameStateTypingWords = data['game']['gameStateTypingWords'];
            }
            if (isDefined(data['game']['gameStatePlaying'])) {
                prevState.gameStatePlaying = data['game']['gameStatePlaying'];
            }
            if (isDefined(data['game']['gameStateEnded'])) {
                prevState.gameStateEnded = data['game']['gameStateEnded'];
            }

            if (isDefined(data['game']['playersOrder'])) {
                prevState.playersOrder = data['game']['playersOrder'];
            }
            if (isDefined(data['game']['observersOrder'])) {
                prevState.observersOrder = data['game']['observersOrder'];
            }
            if (isDefined(data['game']['explainPlayerId'])) {
                prevState.explainPlayerId = data['game']['explainPlayerId'];
            }
            if (isDefined(data['game']['guessPlayerId'])) {
                prevState.guessPlayerId = data['game']['guessPlayerId'];
            }
            prevState.myRound = ((prevState.me.userIdHash === prevState.explainPlayerId) ||
                                 (prevState.me.userIdHash === prevState.guessPlayerId));
            if (isDefined(data['game']['explainPlayerConfirmed'])) {
                prevState.explainPlayerConfirmed = data['game']['explainPlayerConfirmed'];
            }
            if (isDefined(data['game']['guessPlayerConfirmed'])) {
                prevState.guessPlayerConfirmed = data['game']['guessPlayerConfirmed'];
            }
            if (isDefined(data['game']['roundStateConfirmation'])) {
                prevState.roundStateConfirmation = data['game']['roundStateConfirmation'];
            }
            if (isDefined(data['game']['roundStatePlaying'])) {
                prevState.roundStatePlaying = data['game']['roundStatePlaying'];
            }
            if (prevState.roundStatePlaying || prevState.roundStateConfirmation) {
                prevState.roundStateFinishing = false;
            }
            if (isDefined(data['game']['roundNumber'])) {
                if (prevState.roundNumber !== data['game']['roundNumber']) {
                    prevState.roundNumber = data['game']['roundNumber'];
                    prevState.roundStateFinishing = false;
                }
            }
            if (isDefined(data['game']['circleNumber'])) {
                prevState.circleNumber = data['game']['circleNumber'];
            }
            if (isDefined(data['game']['epochNumber'])) {
                prevState.epochNumber = data['game']['epochNumber'];
            }

            if (isDefined(data['game']['initialWordsInHat'])) {
                prevState.initialWordsInHat = data['game']['initialWordsInHat'];
            }

            if (isDefined(data['game']['currentWordsInHat'])) {
                prevState.currentWordsInHat = data['game']['currentWordsInHat'];
            }

            if (isDefined(data['game']['wordsMode'])) {
                prevState.wordsMode = data['game']['wordsMode'];
            }

            console.log('newState=', prevState);
            return prevState;
        });
    }

    private nextWordHandler = (data: any) => {
        this.setState((prevState) => {
            return {wordToExplain: data['word'],
                    roundStateConfirmation: false,
                    roundStatePlaying: true,
                    roundStateFinishing: false};
        });
    }

    private startGame = () => {
        const gameMode = ['CIRCLE', 'RANDOM_PAIRS', 'ASSIGNED_PAIRS'];
        this.sendEvent('gameStarted',
                       {'secondsPerRound': this.state.secondsPerRound,
                        'gameMode': gameMode[this.state.gameModeIndex],
                        'ownerIsObserver': this.state.me.observer,
                        'playersPairs': (this.state.gameModeIndex === 2) ? this.state.playersPairs : null});
    }

    private confirmRound = () => {
        this.sendEvent('roundConfirmed', {roundNumber: this.state.roundNumber});
    }

    private wordGuessed = () => {
        this.disableAndEnableButtonsLater();
        this.sendEvent('wordGuessed', {});
    }

    private disableButtons = () => {
        this.setState({buttonsDisabled: true});
    }

    private enableButtons = () => {
        this.setState({buttonsDisabled: false});
    }
    
    private disableAndEnableButtonsLater = () => {
        this.disableButtons();
        sleep(1000).then(() => {this.enableButtons()});
    }

    private handleObserverChange = (value: boolean) => {
        this.setState((prevState) => {
            let newMe = prevState.me;
            newMe.observer = value;
            return {me: newMe};
        }, () => this.sendEvent('playerUpdated',  {'player': {observer: value}}));
    }

    private timeExpired = (roundNumber: number) => {
        if (roundNumber == this.state.roundNumber) {
            this.setState({
                roundStateConfirmation: false,
                roundStatePlaying: false,
                roundStateFinishing: true});
        }
    }

    private roundComplete = (result: string) => {
        this.disableAndEnableButtonsLater();
        this.setState({
            roundStateConfirmation: false,
            roundStatePlaying: false,
            roundStateFinishing: false,
            guessPlayerConfirmed: undefined,
            explainPlayerConfirmed: undefined,
            wordToExplain: undefined});
        this.sendEvent('roundComplete', {'lastWordResult': result});
    }

    private wordsTypingComplete = (words: (Array<string>), dictionary: (string|null)) => {
        this.sendEvent('putWordsInHat', {gameId: this.state.gameId,
                                         player: this.state.me,
                                         words: words,
                                         dictionary: dictionary});
    }

    private removePlayer = (playerIdHash: string) => {
        this.sendEvent('removePlayer', {gameId: this.state.gameId,
                                        playerToRemoveId: playerIdHash});
    }

    private replayPreviousRound = () => {
        this.sendEvent('replayPreviousRound', {roundNumber: this.state.roundNumber});
    }

    handleGameModeChange = (index: number) => {
        this.setState({gameModeIndex: index});
    }

    private setRoundTime = (value:number) => {
         this.setState({secondsPerRound: value});
    }

    private setPairs = (pairs: Array<[string, string]>) => {
        this.setState({
            playersPairs: pairs,
            playersPairsKay: this.state.playersPairsKay + 1
        });
    }

    private renderTypingWords = () => {
        const gameLink = this.state.host + '/game/' + this.state.gameId;
        let linkLabel = <p> Creating game. </p>;
        if (this.state.gameId) {
            linkLabel = <div>
                <p>Share game link with other players: </p>
                <div className="InRowContainer">
                    <p id="GameLink"><a href={this.state.gameId} id="GameLinkToCopy"> {gameLink} </a></p>
                    <ThemeProvider theme={theme}>
                    <TooltipButton
                        id="CopyButton"
                        className="CopyTooltip"
                        data-clipboard-text={gameLink}
                        tooltip="Copy link to clipboard"
                        tooltipPosition='top'
                        tooltipDelay={200} >

                        <img id="CopyButtonImg" src="/clippy.svg" alt="Copy link to clipboard"></img>
                    </TooltipButton>
                    </ThemeProvider>
                </div>
            </div>
        };
        let wordsForm = <div></div>;
        let startButton = <div></div>;
        let modeChoose = <div></div>;
        let timeSlider = <div></div>;
        let playerObserverCheckbox = <div></div>;
        let needTypingWords = ((this.state.me.putWordsInHat !== true) &&
                               (
                                   (this.state.wordsMode == 'DICT' && (this.state.me.owner)) ||
                                   (this.state.wordsMode == 'PLAYERS')
                               ))
        if (needTypingWords) {
            if (this.state.initialized) {
                if (this.state.wordsMode == 'PLAYERS') {
                    wordsForm = <WordsTypingList
                                     numWords={this.state.wordsPerPlayer}
                                     onComplete={this.wordsTypingComplete}/>
                }
                if (this.state.wordsMode == 'DICT' && this.state.me.owner) {
                    wordsForm = <DictTypingForm
                                     numWords={this.state.wordsPerPlayer}
                                     onComplete={this.wordsTypingComplete}/>
                }
            }
        } else {
            let everyoneIsReady = (this.state.players.size > 1);
            this.state.players.forEach((player) => {
                everyoneIsReady = everyoneIsReady && (player.putWordsInHat === true);
            });
            let pairsReady = true;
            if (this.state.gameModeIndex == 2) {
                if ((this.state.playersPairs.length * 2 !== this.state.playersOrder.length) && !this.state.me.observer) {
                    pairsReady = false;
                }
                if ((this.state.playersPairs.length * 2 !== this.state.playersOrder.length - 1) && this.state.me.observer) {
                    pairsReady = false;
                }
                this.state.playersPairs.forEach((pair) => {
                    if (pair[0] === '' || pair[1] === '') {
                        pairsReady = false;
                    }
                });
            }
            if (this.state.me.owner) {
                let evenError = <div> </div>;
                let pairAssignForm = <div> </div>;
                if (((this.state.players.size % 2 == 1) && !this.state.me.observer) ||
                    ((this.state.players.size % 2 == 0) && this.state.me.observer))
                {
                    evenError = <div>
                        Pair mode is possible only with even number of players
                    </div>;
                    if (this.state.gameModeIndex == 1 || this.state.gameModeIndex == 2) {
                        everyoneIsReady = false;
                    }
                } else {
                    pairAssignForm = <div>
                        <PairSelectionForm
                            players={this.state.players}
                            playersOrder={this.state.playersOrder.filter((playerId)=>{return !unwrap(this.state.players.get(playerId)).observer})}
                            playersPairs={this.state.playersPairs}
                            pairsCallback={this.setPairs}
                            key={this.state.playersPairsKay.toString()}
                        />
                    </div>;
                }
                modeChoose = <div>
                    <ThemeProvider theme={theme}>
                <section>
                   <Tabs
                       fixed
                       index={this.state.gameModeIndex}
                       onChange={this.handleGameModeChange}
                       className="GameModeTabs">
                      <Tab label='Circle' activeClassName='ActiveTab' className='InactiveTab'>
                      <div></div>
                      </Tab>
                      <Tab label='Random Pairs' activeClassName='ActiveTab' className='InactiveTab'>
                      <div>{evenError}</div>
                      </Tab>
                      <Tab label='Assigned Pairs' activeClassName='ActiveTab' className="InactiveTab">
                      <div>
                           {evenError}
                           {pairAssignForm}
                      </div>
                      </Tab>
                   </Tabs>
                </section>
                </ThemeProvider>
                </div>
                timeSlider = <div>
                    <p>Time per round in seconds:</p>
                    <ThemeProvider theme={theme}>
                    <Slider min={5} max={180} step={1}
                            pinned
                            editable
                            value={this.state.secondsPerRound}
                            onChange={this.setRoundTime}
                            className="Slider"/>
                    </ThemeProvider>
                </div>

                if (this.state.wordsMode === 'DICT') {
                    playerObserverCheckbox = <ThemeProvider theme={theme}>
                        <Checkbox
                            checked={this.state.me.observer}
                            label="Be an observer, not a player"
                            onChange={this.handleObserverChange}
                        />
                    </ThemeProvider>
                }

                startButton = <ThemeProvider theme={theme}>
                <Button
                    className="Button"
                    disabled={!everyoneIsReady || !pairsReady}
                    label="Everyone's ready, start the game."
                    onClick={this.startGame}
                    type="submit"/>
                </ThemeProvider>
            } else {
                startButton = <label>Waiting for other players</label>;
            }
        }
        return <div>
            <div>
                <p> Hi, {this.props.creatorName}! </p>
                {linkLabel}
            </div>
            <div>{wordsForm}</div>
            <div>{timeSlider}</div>
            <div>{modeChoose}</div>
            <div>{playerObserverCheckbox}</div>
            <div>{startButton}</div>
        </div>;
    }

    private renderRound() {
        if (this.state.roundNumber >= 0) {
            let explainPlayer = unwrap(this.state.players.get(this.state.explainPlayerId));
            let guessPlayer = unwrap(this.state.players.get(this.state.guessPlayerId));
            let explainPlayerLabelClassName = "RoundLabelsContainerLabel";
            if (this.state.me.userIdHash === explainPlayer.userIdHash) {
                explainPlayerLabelClassName = "RoundLabelsContainerLabel UserLabel";
            }
            let guessPlayerLabelClassName = "RoundLabelsContainerLabel";
            if (this.state.me.userIdHash === guessPlayer.userIdHash) {
                guessPlayerLabelClassName = "RoundLabelsContainerLabel UserLabel";
            }
            let roundLabels = <div className="RoundLabelsContainer">
                <label className={explainPlayerLabelClassName}>{explainPlayer.name}</label>
                <div className="RoundLabelsContainerLabelDiv"><label id="RoundLabelsContainerAnd"> and </label></div>
                <label className={guessPlayerLabelClassName}>{guessPlayer.name}</label>
            </div>;
            let timer = <div></div>;
            if (this.state.roundStateFinishing) {
                timer = <div id="TimerReplacementDiv">00 : 00</div>;
            }
            if (this.state.roundStatePlaying) {
                timer = <div id="TimerDiv">
                <Timer
                    secondsFor={this.state.secondsPerRound}
                    stopCallback={this.timeExpired.bind(this, this.state.roundNumber)}/></div>;
            }

            let repeatRoundButton = <div></div>;
            if (this.state.me.owner) {
                let replacePreviousRoundClass = "Button";
                if (this.state.roundNumber == 0) {
                    replacePreviousRoundClass = "Button DoNotDisplay";
                }
                repeatRoundButton =
                    <ThemeProvider theme={theme}>
                    <Button
                        className={replacePreviousRoundClass}
                        label="Replay previous round"
                        onClick={this.replayPreviousRound}
                        disabled={this.state.buttonsDisabled}
                        type="submit"/>
                    </ThemeProvider>
            }

            let confirmForm = <div></div>;
            let wordForm = <div ></div>;
            if (this.state.myRound) {
                if (this.state.roundStateConfirmation && (
                       ((this.state.me.userIdHash === explainPlayer.userIdHash) && !this.state.explainPlayerConfirmed) ||
                       ((this.state.me.userIdHash === guessPlayer.userIdHash) && !this.state.guessPlayerConfirmed)))
                {
                    confirmForm = <div className="RoundButtonContainer">
                        <ThemeProvider theme={theme}>
                        <Button
                            className="Button"
                            label="I'm ready"
                            onClick={this.confirmRound}
                            disabled={this.state.buttonsDisabled}
                            type="submit"/>
                        </ThemeProvider>
                        <ThemeProvider theme={theme}>
                        <Button
                            className="Button"
                            label="Skip round"
                            onClick={() => this.roundComplete('NOT_GUESSED')}
                            disabled={this.state.buttonsDisabled}
                            type="submit"/>
                        </ThemeProvider>

                        {repeatRoundButton}
                    </div>;
                }
                if (this.state.wordToExplain && (this.state.roundStatePlaying || this.state.roundStateFinishing)) {
                    let notGuessedClass = "Button";
                    let guessedCallback = this.wordGuessed;
                    if (this.state.roundStatePlaying) {
                        notGuessedClass = "Button DoNotDisplay";
                    }
                    if (this.state.roundStateFinishing) {
                        guessedCallback  = this.roundComplete.bind(this, 'GUESSED');
                    }
                    wordForm = <div className="GameChild">
                        <label id="WordToExplain">
                            {this.state.wordToExplain}
                        </label>
                        <div className="RoundButtonContainer">
                            <ThemeProvider theme={theme}>
                            <Button
                                className="Button"
                                label="Guessed"
                                onClick={guessedCallback}
                                disabled={this.state.buttonsDisabled}
                                key={'guessed_button' + this.state.roundNumber.toString() +
                                     '_' + this.state.roundStatePlaying.toString() +
                                     '_' + this.state.roundStateFinishing.toString()}
                                type="submit"/>
                            </ThemeProvider>

                            <ThemeProvider theme={theme}>
                            <Button
                                className="Button"
                                label="Error"
                                onClick={() => this.roundComplete('ERROR')}
                                disabled={this.state.buttonsDisabled}
                                type="submit"/>
                            </ThemeProvider>

                            <ThemeProvider theme={theme}>
                            <Button
                                className={notGuessedClass}
                                label="Next round"
                                onClick={() => this.roundComplete('NOT_GUESSED')}
                                disabled={this.state.buttonsDisabled}
                                type="submit"/>
                            </ThemeProvider>
                        </div>
                    </div>
                }
            } else if (this.state.me.owner) {

                if (this.state.roundStateConfirmation && ((!this.state.explainPlayerConfirmed) || (!this.state.guessPlayerConfirmed))) {
                    confirmForm = <div className="RoundButtonContainer">
                        <ThemeProvider theme={theme}>
                        <Button
                            className="Button DoNotDisplay"
                            label="no display"
                            disabled={true}
                            type="submit"/>
                        </ThemeProvider>
                        <ThemeProvider theme={theme}>
                        <Button
                            className="Button"
                            label="Skip round"
                            onClick={() => this.roundComplete('NOT_GUESSED')}
                            disabled={this.state.buttonsDisabled}
                            type="submit"/>
                        </ThemeProvider>

                        {repeatRoundButton}
                    </div>;
                }
            }
            return <div className="RoundContainer">
               {roundLabels}
               {timer}
               <div className="GameChild">
               {confirmForm}
               {wordForm}
               </div>
            </div>;
        } else {
            return <div></div>;
        }
    };

    private renderResults() {
        return <div className="CenterText">Hat is empty!</div>;
    }

    private renderGameState() {
        return <div className="GameState">
             <div className="GameStateLabel">
                 {"\u25cf "}
                 {this.state.epochNumber + 1}
             </div>
             <div className="GameStateLabel">
                 {" \u27f3 "}
                 {this.state.circleNumber + 1}
             </div>
             <div className="GameStateLabel">
                 <i className="fa fa-arrows-h" aria-hidden="true"></i>
                 {" "}
                 {this.state.roundNumber + 1}
             </div>
             <div className="GameStateLabel">
                 <i className="fa fa-bars" aria-hidden="true"></i>
                 {" "}
                 {this.state.currentWordsInHat} / {this.state.initialWordsInHat}
             </div>
        </div>
    }

    public render() {
        let game = <div></div>;
        if (this.state.gameStateTypingWords) {
            game = this.renderTypingWords();
        }
        let gameState = <div></div>
        if (this.state.gameStatePlaying) {
            game = this.renderRound();
            gameState = this.renderGameState();
        }
        if (this.state.gameStateEnded) {
            game = this.renderResults();
        }
        return (
          <div>
            <div className="GameContainer">
                <div className="GameChild">
                    {game}
                </div>
                <div>
                    <div> {gameState} </div>
                    <PlayerList
                        players={this.state.players}
                        playersOrder={this.state.playersOrder}
                        explainPlayerId={this.state.explainPlayerId}
                        guessPlayerId={this.state.guessPlayerId}

                        gameStateTypingWords={this.state.gameStateTypingWords}
                        gameStatePlaying={this.state.gameStatePlaying}
                        gameStateEnded={this.state.gameStateEnded}
                        me={this.state.me}

                        removePlayer={this.removePlayer}
                    />
                </div>
            </div>
          </div>
        );
    }
}

export default Game;