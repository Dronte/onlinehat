
export interface IPlayer {
    name: string;
    userIdHash?: string;
    owner?: boolean;

    observer?: boolean;
    putWordsInHat?: boolean;

    guessedByEpoch?: number;
    explainedByEpoch?: number;
    guessedByCircle?: number;
    explainedByCircle?: number;
    guessedTotal?: number;
    explainedTotal?: number;

};


export default IPlayer;
