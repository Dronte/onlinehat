import * as React from 'react';


interface IProps {
    stopCallback: () => void;
    secondsFor: number;
}

interface IState {
    secondsLeft: number;
    finishAt: Date;
}

class Timer extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        let time = new Date();
        time.setSeconds(time.getSeconds() + this.props.secondsFor);
        this.state = {
            secondsLeft: this.props.secondsFor,
            finishAt: time
        };
        this.frameId = 0;
    }
    frameId: number;

    componentDidMount() {
        this.start()
    }
  
    // Clean up by cancelling any animation frame previously scheduled
    componentWillUnmount() {
        this.stop()
    }

    start = () => {
        this.frameId = requestAnimationFrame(this.tick);
    }

    stop = () => {
        this.props.stopCallback();
    }

    tick = () => {
        const timeLeftMilliseconds = this.state.finishAt.getTime() - (new Date()).getTime();
        if (timeLeftMilliseconds <= 0) {
            this.setState(
                { secondsLeft: 0 },
                () => this.frameId = requestAnimationFrame(this.tick)
            )
            this.stop(); // FIXME (?) schedule after setState?
        } else {
            const secondsLeft = Math.ceil(timeLeftMilliseconds / 1000);
            if (secondsLeft !== this.state.secondsLeft) {
                this.setState(
                    { secondsLeft: secondsLeft },
                    () => this.frameId = requestAnimationFrame(this.tick)
                )
            } else {
                this.frameId = requestAnimationFrame(this.tick);
            }
        }
    }

    public render() {
        let minutes = Math.floor(this.state.secondsLeft / 60);
        let seconds = this.state.secondsLeft - minutes*60;
        return <div>{minutes} : {seconds.toString().padStart(2, "0")}</div>;
        
    }
}


export default Timer;