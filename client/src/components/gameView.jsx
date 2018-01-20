import React from 'react';
import _ from 'underscore';
import MultiplayerGame from '../components/multiplayerGame.jsx';
import MultiplayerResults from '../components/multiplayerResults.jsx';
import {List, ListItem} from 'material-ui/List';
import Subheader from 'material-ui/Subheader';
import Avatar from 'material-ui/Avatar';
import CheckBox from 'material-ui/svg-icons/toggle/check-box';
import CheckBoxOutline from 'material-ui/svg-icons/toggle/check-box-outline-blank';
import RaisedButton from 'material-ui/RaisedButton';
import Paper from 'material-ui/Paper';
import CircularProgress from 'material-ui/CircularProgress';
import ChatRoom from './chatRoom.jsx';
import axios from 'axios';
import GroupAdd from 'material-ui/svg-icons/social/group-add';
import Check from 'material-ui/svg-icons/navigation/check';
import IconButton from 'material-ui/IconButton';
import Divider from 'material-ui/Divider';
import {Tabs, Tab} from 'material-ui/Tabs';

class GameView extends React.Component {
  constructor (props) {
    super(props)    
    this.state = this.props.state; 
    this.state.countdown = 0;
    this.state.userFriends = [];
    this.state.tabValue = 'results';

    const styles = {
      headline: {
        fontSize: 24,
        paddingTop: 16,
        marginBottom: 12,
        fontWeight: 400,
      },
    }

    this.handleReadyClick = this.handleReadyClick.bind(this);
    this.beginGame = this.beginGame.bind(this);
    this.handleFinishedUser = this.handleFinishedUser.bind(this);
    this.getUserFriends = this.getUserFriends.bind(this);
    this.addFriend = this.addFriend.bind(this);
    this.handleTabClick = this.handleTabClick.bind(this);
  }

  handleTabClick (tabValue) {
    this.setState({tabValue})
  }

  componentDidMount () {
    this.getUserFriends();
  }

  addFriend (friendUsername) {
    axios.post('/friends', { 
      params: {
        loggedInUsername: this.state.username,
        friendUsername: friendUsername
      }
    }).then((results) => {
      this.getUserFriends();
    }).catch((err) => {
      console.log('error on add friend',err);
    })
  }

  getUserFriends () {
    axios.get('/friends', {
      params: {
        username: this.state.username
      }
    }).then((response) => {
      console.log('response from get userFriends on client', response);
      this.setState({userFriends:_.pluck(response.data, 'username')})
    })
  }

  componentWillMount () {
    var connection = this.state.db.ref('/rooms/' + this.state.roomId)
    connection.on('value', (snapshot => {
      this.updateRoomInfo(snapshot.val())
    })) 
  }

  handleFinishedUser (score, accuracy, time, arrayWithResults) {
    console.log('FINISHED RESULTS', score, accuracy, time);
    let userResultsDb = this.state.db.ref('/rooms/' + this.state.roomId + '/users/' + this.state.userId + '/results');
    userResultsDb.set({score, accuracy, time});
    let userDb = this.state.db.ref('/rooms/' + this.state.roomId + '/users/' + this.state.userId + '/finished');
    userDb.set(true);
    this.setState({
      userDone: true,
      arrayWithResults: arrayWithResults
    });
  }

  checkAllReady () {
    if ( _.filter(this.state.users, (user) => user.ready).length === this.state.users.length) {
      var roomWaiting = this.state.db.ref('/rooms/' + this.state.roomId + '/waiting');
      roomWaiting.set(false);
    }
  }

  updateRoomInfo(roomInfo) {
    let gameComplete = roomInfo.gameComplete;

    if (this.state.gameInProgress !== roomInfo.gameInProgress) {
      this.setState({gameInProgress: roomInfo.gameInProgress});
    }

    let waiting = roomInfo.waiting;

    if (!this.state.gameInfo) {
      let rawGameInfo = roomInfo.gameInfo;
      let parsedGameInfo = [];

      for (let rawQuestionKey in rawGameInfo) {
        let rawQuestion = rawGameInfo[rawQuestionKey];
        let parsedQuestion = {};
        parsedQuestion.correctAnswer = rawQuestion.correctAnswer;
        parsedQuestion.questionString = rawQuestion.questionString;
        parsedQuestion.answers = [];
        for (let answerKey in rawQuestion.answers) {
          parsedQuestion.answers.push(rawQuestion.answers[answerKey]);
        }
        parsedGameInfo.push(parsedQuestion);
      }

      this.setState({
        gameInfo: parsedGameInfo
      })
    }

    let users = [];
    var userId = null;
    for (let userKey in roomInfo.users) { 
      let user = roomInfo.users[userKey];
      if (user.name === this.state.username) {
        userId = userKey;
        this.props.setUserId(userKey)
      }
      user.id = userKey;
      users.push(user);
    }
    
    this.setState({gameComplete, waiting, users, userId}, () => {
      if (!(_.pluck(this.state.users, 'name').includes(this.state.username))) {
        // add current user to game
        let userDb = this.state.db.ref('/rooms/' + this.state.roomId + '/users');
        let user = {
          name: this.state.username,
          ready: false,
          finished: false,
          profilePictureUrl: this.state.profilePicture
        }
        userDb.push(user);
      }

      if (this.state.waiting && this.state.users.length > 1) {
        this.checkAllReady();
      }

      if (this.state.gameInProgress) {
        this.checkAllCompleted();
      }
    })
  }

  checkAllCompleted () {
    if ( _.filter(this.state.users, (user) => user.finished).length === this.state.users.length) {
      var roomCompleted = this.state.db.ref('/rooms/' + this.state.roomId + '/gameComplete');
      roomCompleted.set(true);
    }
  }

  handleReadyClick () {
    let userDb = this.state.db.ref('/rooms/' + this.state.roomId + '/users/' + this.state.userId + '/ready');
    userDb.set(true);
    this.setState({userReady: true});
  }

  beginGame () {
    let roomDb = this.state.db.ref('/rooms/' + this.state.roomId + '/gameInProgress');
    roomDb.set(true);
  }

  render () {
    if (this.state.waiting) {
      return this.state.users.length ? (
        <div style={{fontFamily: 'Roboto', marginLeft: '300px', width: '800px', alignItems: 'center', textAlign: 'center', marginBottom: '10px'}}>
          <h3>Welcome to {this.state.roomName}</h3>
            <List style={{float: 'left', textAlign: 'center', width: '200px'}}>
              <Subheader>Users</Subheader>
              {this.state.users.map((user) => {
                return (
                  <ListItem
                    primaryText={user.name}
                    leftAvatar={<Avatar src={user.profilePictureUrl}/>}
                    rightIcon={user.ready ? <CheckBox /> : <CheckBoxOutline />}
                  />
                );
              })}
              <RaisedButton disabled={this.state.users.length === 1 || this.state.userReady} onClick={this.handleReadyClick} label="Ready"/>
            </List>
            <div style={{height: 'auto', float: 'left', width: '500px'}}>
              <ChatRoom 
                username={this.state.username}
                db={this.state.db}
                roomId={this.state.roomId}
                profilePicture={this.state.profilePicture}
              />
            </div>
        </div>
      ) : (<div>Loading</div>)
    } else if (!this.state.waiting && !this.state.gameInProgress) {
      setTimeout(this.beginGame, 5000);
      return (<div style={{marginBottom: '5px', textAlign: 'center'}}>
        <h3>All users are ready! Game is about to begin.</h3>
        <CircularProgress
          size={60}
          thickness={7}
        />
        </div>)
    } else if (!this.state.userDone && this.state.gameInProgress) {
      return (
        <div>
          <MultiplayerGame
            username={this.state.username}
            gamesPlayed={this.state.gamesPlayed}
            gameInfo={this.state.gameInfo}
            sendResults={this.handleFinishedUser}
            quitGame={this.props.quitGame}
            updateUserInfo = {this.props.updateUserInfo}
            getUserInfo={this.props.getUserInfo}
            problemType={this.props.problemType}
          />
        </div>
      );
    } else if (this.state.userDone && !this.state.gameComplete) {
      return (<div style={{marginBottom: '5px'}}> 
        <h3>Great job! Results will be displayed when all players have finished.</h3>
        <CircularProgress
          size={60}
          thickness={7}
        />
        </div>)
    } else if (this.state.gameComplete) {
      return (
        <Tabs
          style={{marginLeft: '15%', marginTop: '1%', width: '70%'}}
          value={this.state.value}
          onChange={this.handleTabClick}
        >
        <Tab label="Results" value="results">
          <MultiplayerResults
            users={this.state.users}
            arrayWithResults={this.state.arrayWithResults}
          />
        </Tab>
        <Tab label="Chat" value="chat">
          <div style={{marginTop: '1%'}}>
            <List style={{marginTop: '10px', marginLeft: '15%', float: 'left', textAlign: 'center', width: '200px'}}>
                <Subheader>Users</Subheader>
                {this.state.users.map((user) => {
                  return user.name !== this.state.username ? (
                    <ListItem
                      primaryText={user.name}
                      leftAvatar={<Avatar src={user.profilePictureUrl}/>}
                      rightIcon={this.state.userFriends.includes(user.name) ?
                        <Check /> :
                        <IconButton onClick={() => this.addFriend(user.name)}>
                          <GroupAdd />
                        </IconButton> }
                    />
                  ) : ''
                })}
              </List>
              
              <div style={{height: 'auto', float: 'left', width: '500px'}}>
                <ChatRoom 
                  username={this.state.username}
                  db={this.state.db}
                  roomId={this.state.roomId}
                  profilePicture={this.state.profilePicture}
                />
              </div>
            </div>
          </Tab>
        </Tabs>
      )
    }

  }
}

export default GameView;