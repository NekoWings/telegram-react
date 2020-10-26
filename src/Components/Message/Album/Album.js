/*
 *  Copyright (c) 2018-present, Evgeny Nadymov
 *
 * This source code is licensed under the GPL v.3.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import AlbumItem from './AlbumItem';
import GroupedMessages from './GroupedMessages';
import { albumHistoryEquals } from '../../../Utils/Common';
import { PHOTO_DISPLAY_SIZE } from '../../../Constants';
import MessageStore from '../../../Stores/MessageStore';
import './Album.css';
import DayMeta from '../DayMeta';
import classNames from 'classnames';
import UnreadSeparator from '../UnreadSeparator';
import CheckMarkIcon from '@material-ui/icons/Check';
import MessageAuthor from '../MessageAuthor';
import Forward from '../Forward';
import Reply from '../Reply';
import WebPage from '../Media/WebPage';
import MessageMenu from '../MessageMenu';
import { isChannelChat, isPrivateChat } from '../../../Utils/Chat';
import Meta from '../Meta';
import { getEmojiMatches, getMessageStyle, getText, getWebPage, isMetaBubble, showMessageForward } from '../../../Utils/Message';
import { getMedia } from '../../../Utils/Media';
import EmptyTile from '../../Tile/EmptyTile';
import UserTile from '../../Tile/UserTile';
import ChatTile from '../../Tile/ChatTile';
import { selectMessage } from '../../../Actions/Client';

class Album extends React.Component {
    state = { };

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        const { messageIds, emojiMatches, selected } = this.props;

        if (!albumHistoryEquals(nextProps.messageIds, messageIds)) {
            return true;
        }

        if (nextState.emojiMatches !== emojiMatches) {
            return true;
        }

        if (nextState.selected !== selected) {
            return true;
        }

        return false;
    }

    static getDerivedStateFromProps(props, state) {
        const { displaySize, chatId, messageIds } = props;

        if (messageIds !== state.prevMessageIds) {
            const grouped = new GroupedMessages();
            grouped.calculate(messageIds.map(x => MessageStore.get(chatId, x)), displaySize);

            return {
                grouped,
                prevMessageIds: messageIds
            }
        }

        return null;
    }

    componentDidMount() {
        // MessageStore.on('clientUpdateMessageHighlighted', this.onClientUpdateMessageHighlighted);
        MessageStore.on('clientUpdateMessageSelected', this.onClientUpdateMessageSelected);
        // MessageStore.on('clientUpdateMessageShake', this.onClientUpdateMessageShake);
        MessageStore.on('clientUpdateClearSelection', this.onClientUpdateClearSelection);
        MessageStore.on('updateMessageContent', this.onUpdateMessageContent);
    }

    componentWillUnmount() {
        // MessageStore.off('clientUpdateMessageHighlighted', this.onClientUpdateMessageHighlighted);
        MessageStore.off('clientUpdateMessageSelected', this.onClientUpdateMessageSelected);
        // MessageStore.off('clientUpdateMessageShake', this.onClientUpdateMessageShake);
        MessageStore.off('clientUpdateClearSelection', this.onClientUpdateClearSelection);
        MessageStore.off('updateMessageContent', this.onUpdateMessageContent);
    }

    onClientUpdateMessageSelected = update => {
        const { chatId, messageIds } = this.props;
        const { selected } = update;

        if (chatId === update.chatId && messageIds.some(x => x === update.messageId)) {
            this.setState({ selected: messageIds.every(x => MessageStore.hasSelectedMessage(chatId, x)) });
        }
    };

    onClientUpdateClearSelection = update => {
        if (!this.state.selected) return;

        this.setState({ selected: false });
    };

    onUpdateMessageContent = update => {
        const { chat_id, message_id } = update;
        const { chatId, messageIds, displaySize } = this.props;
        const { emojiMatches: oldEmojiMatches } = this.state;

        if (chatId !== chat_id) return;
        if (!messageIds.some(x => x === message_id)) return;

        const grouped = new GroupedMessages();
        grouped.calculate(messageIds.map(x => MessageStore.get(chatId, x)), displaySize);

        const emojiMatches = null; //getEmojiMatches(chatId, messageId);
        if (emojiMatches !== oldEmojiMatches) {
            this.setState({ emojiMatches, grouped });
        } else {
            this.setState({ grouped });
        }
    };

    handleSelection = () => {
        // if (!this.mouseDown) return;

        const selection = window.getSelection().toString();
        if (selection) return;

        const { chatId, messageIds } = this.props;
        const { selected } = this.state;

        if (selected) {
            for (let i = 0; i < messageIds.length; i++) {
                selectMessage(chatId, messageIds[i], false);
            }
        } else {
            for (let i = 0; i < messageIds.length; i++) {
                selectMessage(chatId, messageIds[i], true);
            }
        }
    };

    render() {
        let { showTail } = this.props;
        const { chatId, messageIds, displaySize, showUnreadSeparator, showTitle, showDate, t = x => x } = this.props;
        const {
            emojiMatches,
            selected,
            highlighted,
            shook,
            copyLink,
            contextMenu,
            left,
            top
        } = this.state;
        const { grouped } = this.state;
        if (!grouped) {
            return null;
        }

        if (!messageIds.length) {
            return null;
        }

        let messageId = messageIds[messageIds.length - 1];
        const message = MessageStore.get(chatId, messageId);
        if (!message) return <div>[empty message]</div>;

        const { content, is_outgoing, views, date, edit_date, reply_to_message_id, forward_info, sender_user_id } = message;

        const isOutgoing = is_outgoing && !isChannelChat(chatId);

        const inlineMeta = (
            <Meta
                className='meta-hidden'
                key={`${chatId}_${messageId}_meta`}
                chatId={chatId}
                messageId={messageId}
                date={date}
                editDate={edit_date}
                views={views}
            />
        );
        const webPage = getWebPage(message);
        let text = null;
        for (let i = 0; i < messageIds.length; i++) {
            const m = MessageStore.get(chatId, messageIds[i]);
            const t = getText(m, !!webPage ? null : inlineMeta, t);
            if (t && t.length) {
                if (text !== null) {
                    text = null;
                    break;
                } else {
                    text = t;
                    messageId = messageIds[i];
                }
            }
        }
        const hasCaption = text !== null && text.length > 0;
        const meta = (
            <Meta
                className={classNames('meta-text', {
                    'meta-bubble': !hasCaption
                })}
                chatId={chatId}
                messageId={messageId}
                date={date}
                editDate={edit_date}
                views={views}
                onDateClick={this.handleDateClick}
            />
        );

        const showForward = showMessageForward(chatId, messageId);
        const showReply = Boolean(reply_to_message_id);
        const suppressTitle = isPrivateChat(chatId);
        const hasTitle = (!suppressTitle && showTitle) || showForward || showReply;
        // const media = getMedia(message, this.openMedia, { hasTitle, hasCaption, inlineMeta, meta });
        const isChannel = isChannelChat(chatId);
        const isPrivate = isPrivateChat(chatId);

        // if (showTail && isMediaContent() && !hasCaption) {
        //     showTail = false;
        // }

        let tile = null;
        if (showTail) {
            if (isPrivate) {
                tile = <EmptyTile small />
            } else if (isChannel) {
                tile = <EmptyTile small />
            } else if (is_outgoing) {
                tile = <EmptyTile small />
            } else if (sender_user_id) {
                tile = <UserTile small userId={sender_user_id} onSelect={this.handleSelectUser} />
            } else {
                tile = <ChatTile small chatId={chatId} onSelect={this.handleSelectChat} />
            }
        }

        const style = { width: grouped.totalWidth - 2 - 2 };
        const withBubble = content['@type'] !== 'messageSticker' && content['@type'] !== 'messageVideoNote';
        const tailRounded = !hasCaption && (content['@type'] === 'messageAnimation' || content['@type'] === 'messageVideo' || content['@type'] === 'messagePhoto');

        const items = grouped.messages.map(x => (
            <AlbumItem
                key={x.id}
                message={x}
                position={grouped.positions.get(x)}
                displaySize={displaySize}
            />));

        return (
            <div>
                {showDate && <DayMeta date={date} />}
                <div
                    className={classNames('message', 'message-album', {
                        'message-rounded': showTitle && showTail && tailRounded,
                        'message-short': !tile,
                        'message-out': isOutgoing,
                        'message-selected': selected,
                        'message-highlighted': highlighted && !selected,
                        'message-group-title': showTitle && !showTail,
                        'message-group': !showTitle && !showTail,
                        'message-group-tail': !showTitle && showTail && !tailRounded,
                        'message-group-tail-rounded': !showTitle && showTail && tailRounded,
                        'message-bubble-hidden': !withBubble
                    })}
                    onMouseOver={this.handleMouseOver}
                    onMouseOut={this.handleMouseOut}
                    onMouseDown={this.handleMouseDown}
                    onClick={this.handleSelection}
                    onAnimationEnd={this.handleAnimationEnd}
                    onContextMenu={this.handleOpenContextMenu}>
                    {showUnreadSeparator && <UnreadSeparator />}
                    <div className='message-body'>
                        <div className='message-padding'>
                            <CheckMarkIcon className='message-select-tick' />
                        </div>
                        <div className={classNames('message-wrapper', { 'shook': shook })}>
                            {tile}
                            <div
                                className={classNames(
                                    'message-content', {
                                    'message-bubble': withBubble,
                                    'message-bubble-out': withBubble && isOutgoing
                                })}
                                style={style}>
                                {withBubble && ((showTitle && !suppressTitle) || showForward) && (
                                    <div className='message-title'>
                                        {showTitle && !showForward && (
                                            <MessageAuthor chatId={chatId} openChat userId={sender_user_id} openUser />
                                        )}
                                        {showForward && <Forward forwardInfo={forward_info} />}
                                    </div>
                                )}
                                {showReply && (
                                    <Reply
                                        chatId={chatId}
                                        messageId={reply_to_message_id}
                                        onClick={this.handleReplyClick}
                                    />
                                )}
                                <div className={classNames(
                                    'album',
                                    { 'album-caption': hasCaption },
                                    { 'album-title': hasTitle }
                                    )}>
                                    <div className='album-wrapper' style={{ width: grouped.totalWidth }}>
                                        {items}
                                    </div>
                                </div>
                                <div
                                    className={classNames('message-text', {
                                        'message-text-1emoji': emojiMatches === 1,
                                        'message-text-2emoji': emojiMatches === 2,
                                        'message-text-3emoji': emojiMatches === 3
                                    })}>
                                    {text}
                                </div>
                                {withBubble && meta}
                            </div>
                            <div className='message-tile-padding' />
                        </div>
                        <div className='message-padding' />
                    </div>
                </div>
            </div>
        );
    }
}

Album.propTypes = {
    chatId: PropTypes.number.isRequired,
    messageIds: PropTypes.arrayOf(PropTypes.number).isRequired,
    displaySize: PropTypes.number,
    showTitle: PropTypes.bool,
    showTail: PropTypes.bool,
    showUnreadSeparator: PropTypes.bool,
    showDate: PropTypes.bool
};

Album.defaultProps = {
    displaySize: PHOTO_DISPLAY_SIZE,
    showTitle: false,
    showTail: false,
    showUnreadSeparator: false,
    showData: false
};

export default Album;