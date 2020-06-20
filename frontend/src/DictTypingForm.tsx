import * as React from 'react';

import Input from 'react-toolbox/lib/input/Input';
import Button from 'react-toolbox/lib/button/Button';

import theme from './assets/react-toolbox/theme'
import './assets/react-toolbox/theme.css'
import ThemeProvider from 'react-toolbox/lib/ThemeProvider';
import './App.css';

interface IProps {
    numWords : number;
    onComplete: ((words: Array<string>, dict: (string|null)) => void);
};

interface IState {
    words : Array<string>;
    input: string;
    sendDisabled: boolean;
    showError: boolean;
};


class DictTypingForm extends React.Component<IProps, IState> {
       
    constructor(props: IProps) {
        super(props);
        let words = Array(this.props.numWords).map(() => {return '';});
        this.state = {
            input: '',
            words: [],
            sendDisabled: false,
            showError: false
        };
    }

    handleInputChange = (value: string) => {
        this.setState((prevState) => {
            let words = value.replace(/(\n|,)+/g, "\n").split("\n").map((s)=>{return s.trim()}).filter((x)=>{return x!==""});
            return {
                input: value,
                words: words
            };
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

    completeDict = (dictName: string) => {
        this.props.onComplete([], dictName);
    }

    public render() {
        let sendButton = <div></div>;
        if (this.props.numWords) {
            sendButton = <ThemeProvider theme={theme}>
            <Button
                className="Button"
                label="Put words in hat"
                disabled={this.state.words.length == 0}
                type="submit"
                onClick={this.complete}/>
            </ThemeProvider>;
        }
        return (
            <div className="wordsTypingList">
                <p>
                    Select a dictionary:
                </p>
                <div className="InRowContainerSpace">
                    <ThemeProvider theme={theme}>
                       <Button
                           className="Button DictButton"
                           label="Russian, simple"
                           type="submit"
                           onClick={this.completeDict.bind(this, 'simple')}/>
                    </ThemeProvider>
                    <ThemeProvider theme={theme}>
                       <Button
                           className="Button DictButton"
                           label="Russian, medium"
                           type="submit"
                           onClick={this.completeDict.bind(this, 'medium')}/>
                    </ThemeProvider>
                    <ThemeProvider theme={theme}>
                       <Button
                           className="Button DictButton"
                           label={"Russian, hard"}
                           type="submit"
                           onClick={this.completeDict.bind(this, 'hard')}/>
                    </ThemeProvider>
                </div>
                <p>
                    Or type your own words.
                </p>
                <p>
                    Random words from your list, according to number of players and inital settings will be put in hat.
                </p>
                <form autoComplete="off">
                    <ThemeProvider theme={theme} key='text'>
                    <Input type='text'
                           value={this.state.input} 
                           multiline={true}
                           hint='Words to put in hat, newline- or comma-separated.'
                           onChange={this.handleInputChange}
                           rows={10}
                           key='textinput'
                           />
                    </ThemeProvider>
                </form>
                <p>
                   {this.state.words.length.toString()} words
                </p>
                {sendButton}
            </div>
        );
    };
}

export default DictTypingForm;