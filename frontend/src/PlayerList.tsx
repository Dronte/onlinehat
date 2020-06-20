import * as React from 'react';
import IPlayer from './Player';

import Tab from 'react-toolbox/lib/tabs/Tab';
import Tabs from 'react-toolbox/lib/tabs/Tabs';

import IconMenu from 'react-toolbox/lib/menu/IconMenu';
import MenuItem from 'react-toolbox/lib/menu/MenuItem';

import ThemeProvider from 'react-toolbox/lib/ThemeProvider';
import theme from './assets/react-toolbox/theme'

import './PlayerList.css'

interface IProps {
    players: Map<string, IPlayer>;
    playersOrder: Array<string>;

    explainPlayerId: string;
    guessPlayerId: string;

    gameStateTypingWords: boolean;
    gameStatePlaying: boolean;
    gameStateEnded: boolean;

    me: IPlayer;

    removePlayer: (playerIdHash: string) => void;
};

interface IState {
    tabIndex: number;
};

interface IPlayerListState {
};


function unwrap<T> (value: T | undefined | null, errorMessage?: string): T {
    if (value === null || value === undefined) {
        throw new Error(errorMessage || 'Missing value')
    } else {
        return value
    }
}


interface IPlayerResult {
    explained: number;
    guessed: number;
}


function getPlayerResultTotal(player: IPlayer) {
    return {
        explained: unwrap(player.explainedTotal),
        guessed: unwrap(player.guessedTotal)
    } as IPlayerResult;
}


function getPlayerResultByCircle(player: IPlayer) {
    return {
        explained: unwrap(player.explainedByCircle),
        guessed: unwrap(player.guessedByCircle)
    } as IPlayerResult;
}

function getPlayerResultByEpoch(player: IPlayer) {
    return {
        explained: unwrap(player.explainedByEpoch),
        guessed: unwrap(player.guessedByEpoch)
    } as IPlayerResult;
}

function renderTable(tableHeader: any, props: IProps, getResults: (player: IPlayer)=>IPlayerResult) {
     return (
         <table>
             <thead>
                 {tableHeader}
             </thead>
             <tbody>
                 {props.playersOrder.map(playerId => {
                     const player = unwrap(props.players.get(playerId));
                     let playerName = <div>{player.name}</div>;
                     const playerResut = getResults(player);
                     if (player.userIdHash === props.me.userIdHash) {
                         playerName = <div className="ThisPlayer"> {player.name} </div>;
                     }
                     let explain = "";
                     if (player.userIdHash == props.explainPlayerId && props.gameStatePlaying) {
                         explain = "\u27A4";
                     }
                     let guess = "";
                     if (player.userIdHash == props.guessPlayerId && props.gameStatePlaying) {
                         guess = "\u27A4";
                     }
                     return <tr key={player.userIdHash}>
                                 <td className="ExplainPlayerColumnt">{explain}</td>
                                 <td className="GuessPlayerColumn">{guess}</td>
                                 <td className="PlayerNameColumn">{playerName}</td>
                                 <td className="PlayerResult">{playerResut.explained}</td>
                                 <td className="PlayerResult">{playerResut.guessed}</td>
                                 <td className="PlayerResult">{playerResut.guessed + playerResut.explained}</td>
                            </tr>
                     
                 })}
             </tbody>
         </table>);
}




class TabbedResults extends React.Component<IProps, IState> {

    constructor(props: IProps) {
        super(props);
        this.state = {
            tabIndex: 0
        };
    }

    handleTabChange = (newTabIndex: number) => {
        this.setState({
            tabIndex: newTabIndex
        });
    }

    public render () {
        const tableHeader = <tr>
                <td></td>
                <td></td>
                <td></td>
                <td><div className="Icon"><i className="fa fa-bullhorn" aria-hidden="true"/></div></td>
                <td><div className="Icon"><i className="fa fa-lightbulb-o" aria-hidden="true"/></div></td>
                <td> <div className="Icon">𝝨</div> </td>
                </tr>;
        return (
            <div className="PlayerListContainer">
            <div className="PlayerList">
            <ThemeProvider theme={theme}>
            <Tabs
                 fixed
                 index={this.state.tabIndex}
                 onChange={this.handleTabChange}
                 className="GameModeTabs">
                <Tab label='Full Results' activeClassName='ActiveTab'>
                    {renderTable(tableHeader, this.props, getPlayerResultTotal)}
                </Tab>
                <Tab label='Results till last full circle' activeClassName='ActiveTab'>
                    {renderTable(tableHeader, this.props, getPlayerResultByCircle)}
                </Tab>
                <Tab label='Results till last full epoch' activeClassName='ActiveTab'>
                    {renderTable(tableHeader, this.props, getPlayerResultByEpoch)}
                </Tab>
            </Tabs>
            </ThemeProvider>
            </div>
            </div>
        )
    }
}


export class PlayerList extends React.Component<IProps, IPlayerListState> {

    constructor(props: IProps) {
        super(props);
        this.state = {
        };
    }

    public menuItemSelected(playerId: string, item: string) {
        console.log('selected ', item, playerId);
        if (item == 'remove') {
            this.props.removePlayer(playerId);
        }
    }

    private renderMenu(player: IPlayer) {
        let menu = <div></div>;
        const menuIcon = <i className="fa fa-ellipsis-v" aria-hidden="true"></i>;
        const removeIcon = <i className="fa fa-minus" aria-hidden="true"></i>;
        if (this.props.gameStateTypingWords && this.props.me.owner) {
             menu = <ThemeProvider theme={theme}>
                  <IconMenu
                      icon={menuIcon}
                      position='auto'
                      iconRipple
                      menuRipple
                      onSelect={this.menuItemSelected.bind(this, unwrap(player.userIdHash))}>

                      <MenuItem
                          value='remove'
                          icon={removeIcon}
                          caption='Remove from game'
                          disabled={player.owner}
                          />
                  </IconMenu>
               </ThemeProvider>;
        }
        return menu;
    }

    public render() {
        let tableHeader = <tr></tr>;
        /* sigma */
        /* https://unicode-table.com/ru/1D768/ */
        if (this.props.gameStatePlaying) {
            tableHeader = <tr>
                <td></td>
                <td></td>
                <td></td>
                <td><div className="Icon"><i className="fa fa-bullhorn" aria-hidden="true"/></div></td>
                <td><div className="Icon"><i className="fa fa-lightbulb-o" aria-hidden="true"/></div></td>
                <td> <div className="Icon">𝝨</div> </td>
            </tr>;
            return (
                <div className="PlayerListContainer">
                <div className="PlayerList">
                    {renderTable(tableHeader, this.props, getPlayerResultTotal)}
                </div>
                </div>
            )
        }
        if (this.props.gameStateEnded) {
            return <TabbedResults {...this.props} />;
        }
        return (
            <div className="PlayerListContainer">
            <div className="PlayerList">
             <table>
                 <tbody>
                 {this.props.playersOrder.map(playerId => {
                     const player = unwrap(this.props.players.get(playerId));
                     let playerName = <div>{player.name}</div>;
                     if (player.userIdHash === this.props.me.userIdHash) {
                         playerName = <div className="ThisPlayer"> {player.name} </div>;
                     }
                     let ready = "";
                     if (player.putWordsInHat) {
                         ready = "ready";
                     }
                     const menu = this.renderMenu(player);
                     return <tr key={player.userIdHash}>
                                 <td> {menu} </td>
                                 <td className="PlayerNameColumn">{playerName}</td>
                                 <td className="PlayerResult"> {ready} </td>
                            </tr>
                 })}
                 </tbody>
             </table>
            </div>
            </div>
        )
    }
}

export default PlayerList;