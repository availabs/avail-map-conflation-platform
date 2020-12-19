import React from "react"

import styled from "styled-components"

import classnames from "classnames"

import deepequal from "deep-equal"

const MessageContainer = styled.div`
	left: 0px;
	top: 0px;
	position: absolute;
	width: 100%;
	height: 100%;
	z-index: 50;
	pointer-events: none;
	outline: 0;

	display: flex;
	flex-direction: column;
	justify-content: center;

	> * {
		transition: top 0.5s;
	}
`
const MessageStyled = styled.div`
	pointer-events: all;

	position: absolute;
	left: 50%;
	transform: translateX(-50%);

	min-width: 400px;
	display: inline-block;
	padding: 15px 50px 15px 15px;
	color: ${ props => props.theme.textColor };
	background-color: ${ props => props.theme.sidePanelBg };
	text-align: left;
	border-radius: 4px;

	font-size: 1rem;

	&.confirm {
		padding-right: 15px;

		.confirm-buttons-div {
			margin-top: 5px;
			button:first-child {
				float: left;
			}
			button:last-child {
				float: right;
			}
		}
		.confirm-buttons-div::after {
			content: "";
			clear: both;
			display: table;
		}
	}

	@keyframes entering {
		from {
			top: -${ props => props.height }px;
			transform: translateX(-50%) scale(0.25, 0.25);
		}
		to {
			top: ${ props => props.top }px;
			transform: translateX(-50%) scale(1, 1);
		}
	}
	&.entering {
		animation: entering 1.0s;
		transition: top 1.0s;
	}

	@keyframes dismissing {
		from {
			top: ${ props => props.top }px;
			transform: translateX(-50%) scale(1, 1);
		}
		to {
			top: -${ props => props.height }px;
			transform: translateX(-50%) scale(0.25, 0.25);
		}
	}
	&.dismissing {
		animation: dismissing 1.0s;
		transition: top 1.0s;
	}

`
const DismissButton = styled.div`
	position: absolute;
	top: 10px;
	right: 10px;
	padding: 5px;
	width: 30px;
	height: 30px;
	display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 4px;
	color: ${ props => props.theme.textColor };
	background-color: ${ props => props.theme.sidePanelBg };
  transition: background-color 0.15s, color 0.15s;

  :hover {
  	background-color: ${ props => props.theme.textColor };
  	color: ${ props => props.theme.sidePanelBg };
  }
`

class MapMessages extends React.Component {
	static defaultProps = {
		messages: []
	}
	state = {
		dismissing: new Map(),
		timeouts: new Map(),
		heights: new Map()
	}
	componentDidUpdate(oldProps) {
		if (this.props.messages.length > oldProps.messages.length) {
			const length = this.props.messages.length,
				message = this.props.messages[length - 1],
				timeouts = new Map(this.state.timeouts);
			if (message.duration) {
				timeouts.set(
					message.id,
					setTimeout(() => this.readyDismiss(message.id), message.duration)
				);
				this.setState({ timeouts });
			}
		}
		else if ((this.props.messages.length === oldProps.messages.length) &&
							!deepequal(
								oldProps.messages.map(({ id, update }) => ({ id, update})),
								this.props.messages.map(({ id, update }) => ({ id, update}))
							)) {
			this.props.messages.forEach(({ update, id, duration }) => {
				const old = oldProps.messages.find(m => m.id === id);
				if ((old.update !== update) && duration) {
					const timeouts = new Map(this.state.timeouts);
					clearTimeout(timeouts.get(id));
					timeouts.set(
						id,
						setTimeout(() => this.readyDismiss(id), duration)
					)
					this.setState({ timeouts });
				}
			})
		}
	}
	readyDismiss(id) {
		const i = this.props.messages.findIndex(m => m.id === id);
		this.dismiss(id, i);
	}
	dismiss(id, i) {
		clearTimeout(this.state.timeouts.get(id));
		this.state.timeouts.delete(id);

		const message = this.props.messages.find(m => m.id === id);

		this.props.dismiss(id);

		this.state.heights.delete(id);

		id = `${ id }-dismissing`;

		const dismissing = new Map(
			[...this.state.dismissing,
				[id, { timeout: setTimeout(() => this.clear(id), 1000), message: { ...message, id }, i }]
			]
		);
		this.setState({ dismissing });
	}
	clear(id) {
		const dismissing = this.state.dismissing;
		dismissing.delete(id);
		this.setState({ dismissing: new Map(dismissing) });
	}
	reportHeight(id, height) {
		const heights = new Map([...this.state.heights, [id, height]]);
		this.setState({ heights });
	}
	getHeight(id) {
		return this.state.heights.get(id) || 0;
	}
	render() {
		const {
			dismissing
		} = this.state;
		const {
			messages
		} = this.props;
		let Messages = [...messages];
		dismissing.forEach((data, id) => {
			Messages.splice(data.i, 0, data.message);
		})
// console.log("<MapMessages.render>", this.props.messages, dismissing)

		let current = 0;
		const getTop = (id, dismissing) => {
			const height = this.getHeight(id),
				top = current + 10;
			if (!dismissing) current += height + 10;
			return top;
		}
		return (
			<MessageContainer>
				{
					Messages.map(({ id, ...rest }, i) =>
						<MessageFactory key={ id }
							id={ id } { ...rest }
							dismissing={ dismissing.has(id) }
							dismiss={ id => this.readyDismiss(id) }
							zIndex={ messages.length - i - (dismissing ? messages.length : 0)}
							reportHeight={ this.reportHeight.bind(this) }
							height={ this.getHeight(id) }
							top={ getTop(id, dismissing.has(id)) }/>
					)
				}
			</MessageContainer>
		)
	}
}
export default MapMessages

const MessageFactory = ({ ...props }) =>
	props.onConfirm ? <ConfirmMessage { ...props }/> : <Message { ...props }/>
// //
class Message extends React.Component {
	comp = null;
	timeout = null;
	state = {
		entering: !this.props.dismissing
	}
	componentDidMount() {
		this.checkHeight();
		if (this.state.entering) {
			this.timeout = setTimeout(() => this.setState({ entering: false }), 1000);
		}
	}
	componentWillUnmount() {
		clearTimeout(this.timeout);
	}
	componentDidUpdate(oldProps) {
		this.checkHeight();
	}
	checkHeight() {
		const comp = this.comp;
		if (!comp) return;
		const height = comp.clientHeight;
		if (height !== this.props.height) {
			this.props.reportHeight(this.props.id, height);
		}
	}
	renderMessage() {
		const {
			Message,
			dismiss,
			layer,
			id
		} = this.props;
		return (
			<>
				{ typeof Message === "function" ? <Message layer={ layer }/> : Message }
				<DismissButton onClick={ () => dismiss(id) }>
					<span className="fa fa-lg fa-close"/>
				</DismissButton>
			</>
		)
	}
// //
	render() {
		const {
			dismissing,
			zIndex,
			height,
			top,
			onConfirm
		} = this.props;
		const { entering } = this.state,
			confirm = Boolean(onConfirm);

		return (
			<MessageStyled
				className={ classnames({ dismissing, entering, confirm }) }
				ref={ comp => this.comp = comp }
				height={ height }
				style={ {
					zIndex,
					top: `${ top }px`
				} }>
				{ this.renderMessage() }
			</MessageStyled>
		)
	}
}
// //
class ConfirmMessage extends Message {
	renderMessage() {
		const {
			Message,
			dismiss,
			onConfirm,
			layer,
			id
		} = this.props;

		return (
			<>
				{ typeof Message === "function" ? <Message layer={ layer }/> : Message }
				<div className="confirm-buttons-div">
					<button className="btn btn-sm btn-outline-danger"
						onClick={ () => dismiss(id) }>
						Dismiss
					</button>
					<button className="btn btn-sm btn-outline-success"
						onClick={ () => { onConfirm(); dismiss(id); } }>
						Confirm
					</button>
				</div>
			</>
		)
	}
}
