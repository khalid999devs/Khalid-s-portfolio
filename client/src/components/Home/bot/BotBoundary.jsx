import { Component } from 'react';
import PropTypes from 'prop-types';

// The bot is decoration: when its code or model cannot load, the hero stays.
class BotBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

BotBoundary.propTypes = {
  children: PropTypes.node,
};

export default BotBoundary;
