import * as React from 'react';
import IPlayer from './Player';
import Dropdown from 'react-toolbox/lib/dropdown/Dropdown';

import ThemeProvider from 'react-toolbox/lib/ThemeProvider';
import theme from './assets/react-toolbox/theme'
import './Game.css';

interface IProps {
    players: Map<string, IPlayer>;
    playersOrder: Array<string>;
    playersPairs: Array<[string, string]>;
    pairsCallback: (pairs: Array<[string, string]>) => void;
};

interface IPlayerLabel {
    label: string;
    value: string;
};

interface IState {
    playersNames: Array<Array<IPlayerLabel>>;
    playersPairs: Array<[string, string]>;
    numPairs: number;
    randomKey: number;
};

function unwrap<T> (value: T | undefined | null, errorMessage?: string): T {
    if (value === null || value === undefined) {
        throw new Error(errorMessage || 'Missing value')
    } else {
        return value
    }
}

function range(start: number, end: number){
    var rangeArray = [];
    if(start < end){
        for(var i=start; i<end; i++){
            rangeArray.push(i);
        }
    }
    return rangeArray;
};


class PairSelectionForm extends React.Component<IProps, IState> {

    constructor(props: IProps) {
        super(props);
        let numPairs = Math.floor(props.playersOrder.length / 2);
        if (numPairs > 0) {

            let playersPairs = props.playersPairs;
            let assignedPlayersSet = new Set<string>() ;
            playersPairs = playersPairs.filter((pair) => {
                if ((pair[0] == '' || props.playersOrder.findIndex((x) => (x===pair[0])) != -1) &&
                    (pair[1] == '' || props.playersOrder.findIndex((x) => (x===pair[1])) != -1))
                {
                    return true;
                }
                return false;
            });
            playersPairs.forEach((pair) => {
                assignedPlayersSet.add(pair[0]);
                assignedPlayersSet.add(pair[1]);
            });
            while (playersPairs.length < numPairs) {
                playersPairs.push(['', '']);
            }

            let playersNames: Array<IPlayerLabel> = [];
            this.props.playersOrder.forEach( (id) => {
                if (!assignedPlayersSet.has(id)) {
                    const label: IPlayerLabel = {
                        label: unwrap(this.props.players.get(id)).name,
                        value: id
                    }
                    playersNames.push(label);
                }
            });
            const nullLabel: IPlayerLabel = {
                label: ' ',
                value: ''
            }
            playersNames.push(nullLabel);

            let allPlayersNames: Array<Array<IPlayerLabel>> = [];
            range(0, props.playersOrder.length).map((index) => {
                const pairIndex = Math.floor(index / 2);
                const inPairIndex = index % 2;
                const playerId = playersPairs[pairIndex][inPairIndex];
                if (playerId != "") {
                    const label: IPlayerLabel = {
                        label: unwrap(this.props.players.get(playerId)).name,
                        value: playerId
                    }
                    allPlayersNames.push([label].concat(playersNames));
                } else {
                    allPlayersNames.push(playersNames);
                }
            });
            this.state = {
                playersNames: allPlayersNames,
                playersPairs: playersPairs,
                numPairs:     numPairs,
                randomKey:    0
            };
        } else {
            this.state = {
                playersNames: [],
                playersPairs: [],
                numPairs:     numPairs,
                randomKey:    0
            };
        }
    }

    private handleChange = (pairId:number, inPairIndex:number, value:string) => {
        let playersPairs = this.state.playersPairs;
        playersPairs[pairId][inPairIndex] = value;
        this.props.pairsCallback(playersPairs);
    }

    public renderForm = () => {
        let form = range(0, this.state.numPairs).map( (pairIndex: number) => {
               return <div className="PairSelectionPair" key={'pair_' + pairIndex.toString()}>
                  <div className='PairSelectorDiv PairSelectorLeft'>
                      <Dropdown
                          auto
                          className='Dropdown'
                          key={pairIndex.toString()+ '_left_' + this.state.randomKey}
                          onChange={this.handleChange.bind(this, pairIndex, 0)}
                          source={this.state.playersNames[pairIndex*2]}
                          value={this.state.playersPairs[pairIndex][0]}
                      />
                  </div>
                  <div className='PairSelectorDiv PairSelectorRight'>
                      <Dropdown
                          auto
                          className='Dropdown'
                          key={pairIndex.toString()+ '_right_' + this.state.randomKey}
                          onChange={this.handleChange.bind(this, pairIndex, 1)}
                          source={this.state.playersNames[pairIndex*2 + 1]}
                          value={this.state.playersPairs[pairIndex][1]}
                       />
                  </div>
               </div>});
         return form;
    }

    public render() {
        let form = <div></div>;
        if (this.state.numPairs > 0) {
            return <div className="PairSelectionDiv">
               {this.renderForm()}
            </div>;
        }
        return <div className="PairSelectionDiv">
           {form}
        </div>;
    }

}

export default PairSelectionForm;