import { findByName, findByProps, findByStoreName } from "@vendetta/metro";
import { ReactNative } from "@vendetta/metro/common";
import { after, instead } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import Settings from "./components/Settings";
import { DefaultNativeEvent, DoubleTapStateProps, Plugin, NativeEvent } from "./types";

const Chat = findByName("Chat");
const ChatInputRef = findByProps("insertText");
const ChannelStore = findByStoreName("ChannelStore");
const MessageStore = findByStoreName("MessageStore");
const UserStore = findByStoreName("UserStore");
const Messages = findByProps("sendMessage", "startEditMessage");
const ReplyManager = findByProps("createPendingReply");

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
        // initialize
        storage.tapUsernameMention ??= ReactNative.Platform.select({
            android: false,
            ios: true,
            default: true
        })
        storage.reply ??= false;
        storage.delay ??= 300;

        // patch chat area to modify methods
        this.unpatchChat = after("render", Chat.prototype, (_, res) => {
            // patch username tapping to mention user instead
            Boolean(res.props?.onTapUsername) 
                && ReactNative.Platform.OS !== "android" 
                && instead("onTapUsername", res?.props, (args, orig) => {
                    if (!storage.tapUsernameMention) return orig.apply(this, args);

                    const ChatInput = ChatInputRef.refs[0].current;
                    const { messageId } = args[0].nativeEvent;
        
                    const message = MessageStore.getMessage(
                        ChatInput.props?.channel?.id,
                        messageId
                    )
        
                    if (!message) return;
                    ChatInputRef.insertText(`@${message.author.username}#${message.author.discriminator}`)
                });

            // patch tapping a message to require 2 taps and author and provide edit event if both conditions are met
            Boolean(res.props?.onTapMessage) && after("onTapMessage", res?.props, (args) => {
                const { nativeEvent }: { nativeEvent: DefaultNativeEvent } = args[0];
                const ChannelID = nativeEvent.channelId;
                const MessageID = nativeEvent.messageId;

                this.currentTapIndex++;
    
                let timeoutTap = setTimeout(() => {
                    this.currentTapIndex = 0;
                }, storage.delay);
    
                const channel = ChannelStore.getChannel(ChannelID);
                const message = MessageStore.getMessage(ChannelID, MessageID);
    
                Object.assign(nativeEvent, { 
                    taps: this.currentTapIndex, 
                    content: message?.content,
                    authorId: message?.author?.id,
                    isAuthor: message?.author?.id === UserStore.getCurrentUser()?.id
                });

                if (this.currentTapIndex !== 2) 
                    return this.doubleTapState({ 
                        state: "INCOMPLETE", 
                        nativeEvent
                    });

                clearTimeout(timeoutTap);

                ChatInputRef.openSystemKeyboard()

                if ((nativeEvent as NativeEvent)?.authorId === UserStore.getCurrentUser()?.id) {
                    if (storage.userEdit) {
                        const MessageContent = (nativeEvent as NativeEvent).content;
    
                        Messages.startEditMessage(
                            ChannelID,
                            MessageID,
                            MessageContent
                        );
                    } else {
                        ReplyManager.createPendingReply({
                            channel,
                            message,
                            shouldMention: true
                        });
                    }

                    return;
                }
                
                if (storage.reply) {
                    ReplyManager.createPendingReply({
                        channel,
                        message,
                        shouldMention: true
                    })
                }

                this.currentTapIndex = 0;
                this.doubleTapState({ 
                    state: "COMPLETE", 
                    nativeEvent 
                })
            })
        });
    },

    onUnload() {
        this.unpatchChat?.();
    },

    settings: Settings
}

export default BetterChatGestures;