import React from 'react';
import logo from './logo.svg';
import './App.css';

import theme from './assets/react-toolbox/theme'
import './assets/react-toolbox/theme.css'
import ThemeProvider from 'react-toolbox/lib/ThemeProvider';

import Button from 'react-toolbox/lib/button/Button';
import Input from 'react-toolbox/lib/input/Input';
import Slider from 'react-toolbox/lib/slider/Slider';
import Game from './Game';
import Cookies from 'js-cookie';

import Tab from 'react-toolbox/lib/tabs/Tab';
import Tabs from 'react-toolbox/lib/tabs/Tabs';

interface IProps {
}


interface IState {
    gameStarted: boolean;
    gameId?: string;
    playerJoinedToGame: boolean;
    playerToCreateNewGame: boolean;

    wordsPerPlayer: number;
    playerName: string;
    playerNameError?: string;

    wordsMode: number;

    playerWasRemoved: boolean;
}


class App extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            gameStarted: false,
            playerToCreateNewGame: true,
            playerJoinedToGame: false,
            playerName: '',
            playerNameError: undefined,
            wordsPerPlayer: 6,
            wordsMode: 0,
            playerWasRemoved: false
        };
    };

    public newGame = () => {
        if (this.state.playerName != '') {
            this.setState({gameStarted: true});
        } else {
            this.setState({playerNameError: 'Please, enter a name'});
        }
    };

    handleInputChange = (name: string, value: string) => {
        this.setState({...this.state, [name]: value, [name + 'Error']: undefined});
    };

    handleSliderChange = (slider: keyof IState, value: number) => {
        // const newState = {};
        // newState[slider] = value;
        // this.setState({[slider] : value} as Pick<IState, keyof State>);

        this.setState({...this.state, [slider]: value});
    };

    playerRemoved = () => {
        Cookies.remove('gameId', {path: '/'})
        this.setState({
            playerWasRemoved: true,
            playerJoinedToGame: false,
            gameStarted: false,
            playerToCreateNewGame: false
        });
    }

    public componentDidMount() {
        var pathGameId = document.location.pathname.split("game/").slice(-1)[0];
        var playerNameFromCookie = Cookies.get('playerName');
        if (playerNameFromCookie) {
           this.setState({playerName: playerNameFromCookie});
        };
        if ((pathGameId !== '') && (pathGameId !== '/')) {
            pathGameId = pathGameId.replace(/^\/+/, '')
            this.setState({gameId: pathGameId});
            var cookieGameId = Cookies.get('gameId');
            console.log('cookieGameId=', cookieGameId);
            if ((cookieGameId === pathGameId) && playerNameFromCookie) {
                this.setState({playerJoinedToGame: true});
                return;
            }
            this.setState({playerToCreateNewGame: false});
        }
    }

    handleWordsModeChange = (index: number) => {
        this.setState({wordsMode: index});
    }

    public renderWordsTabs() {
        if (this.state.playerToCreateNewGame) {
            // this.newGame(); //todo: remove
            return(<div>
                <ThemeProvider theme={theme}>
                <Tabs fixed
                      index={this.state.wordsMode}
                      onChange={this.handleWordsModeChange}
                      className="WordsTabs">

                      <Tab label='Words typed by players'
                           activeClassName='ActiveTab'
                           className='InactiveTab'>
                          <div></div>
                      </Tab>
                      <Tab label="Words from dictionary"
                           activeClassName='ActiveTab'
                           className='InactiveTab'>
                      <div>We provide some dictionaries in russian. Alternatively, you can type your own words.</div>
                      </Tab>
                </Tabs>
                </ThemeProvider>
                </div>);
        } else {
            return(<div> </div>);
        }
    }

    public renderGameForm() {
        if (this.state.playerToCreateNewGame) {
            // this.newGame(); //todo: remove
            return(<div>
                <p>Words per player</p>
                <ThemeProvider theme={theme}>
                <Slider min={2} max={50} step={1}
                        pinned
                        editable
                        snaps
                        value={this.state.wordsPerPlayer}
                        onChange={this.handleSliderChange.bind(this, 'wordsPerPlayer')}
                        className="Slider"/>
                </ThemeProvider>
                {this.renderWordsTabs()}
                <ThemeProvider theme={theme}>
                <Button className="Button" label="Create New Game" onClick={this.newGame} type="submit"/>
                </ThemeProvider>
                </div>);
        } else {
            return(<div>
                <ThemeProvider theme={theme}>
                <Button label="Join The Game" onClick={this.newGame} type="submit"/>
                </ThemeProvider>
            </div>);
        }
    }

    public render() {
        if (this.state.playerJoinedToGame) {
            return (
                <div>
                <div></div>
                <div className="Main">
                <Game creatorName={this.state.playerName}
                      wordsPerPlayer={this.state.wordsPerPlayer}
                      initialized={false}
                      wordsMode={undefined}
                      gameId={this.state.gameId}
                      playerRemoved={this.playerRemoved} />
                </div>
                <div></div>
                </div>
            );
        }
        if (this.state.gameStarted) {
            let wordsModeString:any = {}
            wordsModeString['0'] = 'PLAYERS';
            wordsModeString['1'] = 'DICT';
            return (
                <div>
                <div></div>
                <div className="Main">
                <Game creatorName={this.state.playerName}
                      wordsPerPlayer={this.state.wordsPerPlayer}
                      initialized={true}
                      wordsMode={wordsModeString[this.state.wordsMode]}
                      gameId={this.state.gameId}
                      playerRemoved={this.playerRemoved}
                      />
                </div>
                <div></div>
                </div>
            );
        } else {
            let explainLabel = <div></div>;
            if (this.state.playerWasRemoved) {
                explainLabel = <p>You were removed from the game by the organizer</p>;
            }
            return (
                <div>
                <div className="Main">
                    <div>{explainLabel}</div>
                    <ThemeProvider theme={theme}>
                    <Input type='playerName'
                           hint='Your name for other players'
                           value={this.state.playerName} 
                           error={this.state.playerNameError}
                           name='playerName'
                           maxLength={64}
                           onChange={this.handleInputChange.bind(this, 'playerName')}/>
                    </ThemeProvider>
                    {this.renderGameForm()}
                </div>
                <div></div>
                </div>
            );
        };
    };
}

export default App;
