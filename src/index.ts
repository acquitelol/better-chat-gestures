import { findByDisplayName, findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import { DefaultNativeEvent ,DoubleTapStateProps, NativeEvent, Plugin } from "./types";

const Chat = findByDisplayName("Chat", false);
const Messages = findByProps("sendMessage", "startEditMessage");
const MessageStore = findByProps("getMessage", "getMessages");
const UserStore = findByProps("getUser", "getCurrentUser")

const DoubleTapToEdit: Plugin = {
    unpatchChat: null,
    currentTapIndex: 0,

    doubleTapState({ state = "UNKNOWN", nativeEvent }: DoubleTapStateProps) {
        const stateObject = { 
            state,
            data: nativeEvent
        };

        if (state == "INCOMPLETE") {
            Object.assign(stateObject, {
                reason: {
                    required: {
                        taps: 2,
                        isAuthor: true
                    },
                    received: {
                        taps: stateObject.data.taps,
                        isAuthor: stateObject.data.isAuthor
                    }
                } 
            })
        }

        return console.log("DoubleTapState", stateObject)
    },

    onLoad() {
        this.unpatchChat = before("default", Chat, (args) => {
            args[0].onTapMessage = (arg: { nativeEvent: DefaultNativeEvent }) => {
                this.currentTapIndex++;
    
                let timeoutTap = setTimeout(() => {
                    this.currentTapIndex = 0;
                }, 300);
    
                const message = MessageStore.getMessage(
                    arg.nativeEvent.channelId, 
                    arg.nativeEvent.messageId
                )
    
                Object.assign(arg.nativeEvent, { 
                    taps: this.currentTapIndex, 
                    content: message?.content,
                    authorId: message?.author?.id,
                    isAuthor: message?.author?.id === UserStore.getCurrentUser()?.id
                });
    
                if ((arg.nativeEvent as NativeEvent)?.authorId !== UserStore.getCurrentUser()?.id
                    || this.currentTapIndex !== 2) return this.doubleTapState({ 
                        state: "INCOMPLETE", 
                        nativeEvent: arg.nativeEvent
                    });
    
                clearTimeout(timeoutTap);
    
                const ChannelID = arg.nativeEvent.channelId;
                const MessageID = arg.nativeEvent.messageId;
                const MessageContent = (arg.nativeEvent as NativeEvent).content;
    
                Messages.startEditMessage(
                    ChannelID,
                    MessageID,
                    MessageContent
                );
                this.currentTapIndex = 0;
                this.doubleTapState({ 
                    state: "COMPLETE", 
                    nativeEvent: arg.nativeEvent 
                })
            }
        })
    },

    onUnload() {
        this.unpatchChat?.();
    }
}

export default DoubleTapToEdit;