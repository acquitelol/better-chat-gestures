import { findByDisplayName, findByProps, findByStoreName } from "@vendetta/metro";
import { after, instead } from "@vendetta/patcher";
import { DefaultNativeEvent, DoubleTapStateProps, Plugin, NativeEvent } from "./types";

const Chat = findByDisplayName("Chat");
const ChatInputRef = findByProps("insertText");
const MessageStore = findByStoreName("MessageStore");
const UserStore = findByStoreName("UserStore");
const Messages = findByProps("sendMessage", "startEditMessage");

const BetterChatGestures: Plugin = {
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
        this.unpatchChat = after("render", Chat.prototype, (_, res) => {
            if (!res.props?.onTapUsername) return;

            instead("onTapUsername", res.props, ([ arg ]) => {
                const ChatInput = ChatInputRef.refs[0].current;
                const { messageId } = arg.nativeEvent;
    
                const message = MessageStore.getMessage(
                    ChatInput.props?.channel?.id,
                    messageId
                )
    
                if (!message) return;
                const existingText = ChatInput?.applicationCommandManager?.props?.text
                ChatInputRef.setText(`${existingText ?? ""}${existingText ? " " : ""}@${message.author.username}#${message.author.discriminator}`)
            });

            instead("onTapMessage", res.props, ([ arg ]) => {
                const { nativeEvent }: { nativeEvent: DefaultNativeEvent } = arg;

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
    
                if ((nativeEvent as NativeEvent)?.authorId !== UserStore.getCurrentUser()?.id
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
            })
        });
    },

    onUnload() {
        this.unpatchChat?.();
    }
}

export default BetterChatGestures;