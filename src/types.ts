// Default properties on the nativeEvent
export interface DefaultNativeEvent {
    target: number;
    messageId: string;
    channelId: string;
}

// Properties added to the nativeEvent by the plugin
export interface SuperNativeEvent {
    authorId: string;
    isAuthor: boolean;
    content: string;
    taps: number;
}

// Full nativeEvent object
export type NativeEvent = DefaultNativeEvent & SuperNativeEvent

// Properties of @func doubleTapState
export interface DoubleTapStateProps {
    state: "COMPLETE" | "INCOMPLETE" | "UNKNOWN";
    nativeEvent: NativeEvent
}

// Properties of entire Plugin object
export interface Plugin {
    unpatchChat: Function | null;
    currentTapIndex: number;
    doubleTapState: (arg: DoubleTapStateProps) => void;
    onLoad: () => void;
    onUnload: () => void;
}