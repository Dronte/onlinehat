import * as React from 'react';

import Input from 'react-toolbox/lib/input/Input';
import Button from 'react-toolbox/lib/button/Button';

import theme from './assets/react-toolbox/theme'
import './assets/react-toolbox/theme.css'
import ThemeProvider from 'react-toolbox/lib/ThemeProvider';
import './App.css';

interface IProps {
    numWords : number;
    onComplete: ((words: Array<string>, _:(string|null)) => void);
};

interface IState {
    words : Array<string>;
    sendDisabled : boolean;
    showError : boolean;
};


class WordsTypingList extends React.Component<IProps, IState> {
       
    constructor(props: IProps) {
        super(props);
        let words = Array(this.props.numWords).map(() => {return '';});
        this.state = {
            words : words,
            sendDisabled : true,
            showError: false
        };
    }

    handleInputChange = (index: number, value: string) => {
        this.setState((prevState) => {
            var newWords = prevState.words.slice();
            newWords[index] = value;
            let nonEmptyWords = 0;
            newWords.forEach((word) => {
                if (word.trim() !== '') {
                    nonEmptyWords += 1;
                }
            });
            let hasEmptyWords = (nonEmptyWords === this.props.numWords);
            return {
                words: newWords, // prevState.words.map((s, _idx) => {if (_idx === index) {return value} else {return s}}),
                sendDisabled : !hasEmptyWords,
                showError: false};
        });
    };

    complete = () => {
        if (!this.state.sendDisabled) {
            this.props.onComplete(this.state.words, null);
        } else {
            this.setState({
                showError: true
            });
        }
    }

    public render() {
        let sendButton = <div></div>;
        if (this.props.numWords) {
            sendButton = <ThemeProvider theme={theme}>
            <Button
                className="Button"
                label="Put words in hat"
                type="submit"
                onClick={this.complete}/>
            </ThemeProvider>;
        }
        return (
            <div className="wordsTypingList">
                <form autoComplete="off">
                {Array.from(Array(this.props.numWords).keys()).map( (i) => {
                    let error: string | undefined;
                    error = undefined;
                    if (this.state.showError && (this.state.words[i] === undefined || this.state.words[i].trim() === '')) {
                        error = 'Please fill all the words';
                    }
                    return (
                        <ThemeProvider theme={theme} key={i.toString()}>
                        <Input type='text'
                               value={this.state.words[i]} 
                               hint='Word to put in hat'
                               name={i.toString()}
                               maxLength={32}
                               onChange={this.handleInputChange.bind(this, i)}
                               key={i.toString()}
                               error={error} />
                        </ThemeProvider>
                        );
                    }
                )}
                </form>
                {sendButton}
            </div>
        );
    };
}

export default WordsTypingList;
