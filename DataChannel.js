var RTCPeerConnection = RTCPeerConnection || webkitRTCPeerConnection || mozRTCPeerConnection;
var RTCSessionDescription = RTCSessionDescription || webkitRTCSessionDescription || mozRTCSessionDescription;
var RTCIceCandidate = RTCIceCandidate || webkitRTCIceCandidate || mozRTCIceCandiate;
var mediaConstraints = {'mandatory': {
  'OfferToReceiveAudio':false,
  'OfferToReceiveVideo':false 
}};

var pc_config = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
var con = { 'optional': [{'RtpDataChannels': true }, {'DtlsSrtpKeyAgreement': true}] };


function EventTarget(){
    this._listeners = {};
}


EventTarget.prototype = {
    constructor: EventTarget,
};


var DataChannel = function(processConnection, myId, receiverId) {
    var that = this;
    that.pc = processConnection;                         //handle process connection of web rtc    
    that.senderId =  myId;
    that.id = receiverId;
    that.localDataChannels = [];
    EventTarget.call(this);
};

DataChannel.prototype = new EventTarget();
DataChannel.prototype.constructor = DataChannel;

var startConnection = function(isInitiator) {
    var that = this;
    // check if process connection already present or not
    if(!that.pc) {
        createPeerConnection.bind(that)(); 
        //    pc.addStream(localVedioStream);
        if(isInitiator) {
            createOffer.bind(that)();
        }
    }
};

var createOffer = function()  {
    var that = this;
    console.log('offer for connection has been created!!!');
    that.pc.createOffer( setLocalAndSendMessage.bind(that), null, mediaConstraints);
};

var createPeerConnection = function() {
    var that = this;
    try {
        that.pc = new RTCPeerConnection(pc_config, con);
        that.pc.onicecandidate = onIceCandidate.bind(that)();
        console.log('create peer connection');
    } catch(e) {
        console.log('error while creating peer connection with ice');    
    }
        
    that.pc.onconnecting = onSessionConnecting.bind(that)();
    that.pc.onopen = onSessionOpened.bind(that)();
    var commandDataChannel  = createDataChannel.bind(that)('command');
    that.localDataChannels.command = that.commandDataChannel;
    that.bindEventToDataChannel(commandDataChannel);
        
};    

var createDataChannel = function(dataChannelName) {
    var that = this;
    var localDataChannel = that.pc.createDataChannel(dataChannelName, {
        reliable: false
    });
    return localDataChannel;
};


//setLocalAndSendMessage(that)

var setLocalAndSendMessage = function(description)  {
    var that = this;
    console.log('media description:' + description);
        //description.sdp = preferOpus(description.sdp);
    that.pc.setLocalDescription(description);
       // pc.ondatachannel = onDataChannel;
    sendMessage.bind(that)(description);
};    

var sendMessage = function(description)  {
    fireEvent.bind(this)('init', description);
};

var fireEvent = function(type, data)  {
    var that = this;
    data = data || {};
    data.recieverId = this.id;
    data.senderId = this.senderId;
    fire.bind(that)(type, data);
};



var onIceCandidate = function(event) {
    var that = this;
    if (event.candidate) {
        console.log('condidate is created!!!');
        that.sendMessage({
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate
            });
    } else {
        console.log("End of candidates.");
    }
};


var onSessionConnecting = function(e) {
};    

var onSessionOpened = function(e) {
};    

    

DataChannel.prototype.bindEventToDataChannel = function(localDataChannel) {
    var that = this;
    localDataChannel.onopen = function() {
            console.log('data channel open');
        };
        
    localDataChannel.onclose = function() {
        console.log('data channel close');
    };
        
    localDataChannel.onmessage = function(event) {
        fire.bind(that)('message', JSON.parse(event.data));
    };
        
};

/*
        every peer will connect with another peer with 'command' data channel to send command for initial 
        connection transfer
*/
var sendCommand = function(message) {
    var that = this;
    var localDataChannel = that.localDataChannels.command;
    if(!localDataChannel) {
        that.createDataChannel('command');
        localDataChannel = that.localDataChannels.command;
    }
    sendDataOverDataChannel(localDataChannel, message);
};

/*
    call start connection method
    this is id of users to identify over server
*/
DataChannel.prototype.init = function(myId, socketId, isInitiator) {
    var that = this;
    //avoid sending first parameter so technically second parameter will be first parameter but first parameter can not be boolean 
    if(myId && socketId && typeof isInitiator != 'undefined') {
        that.senderId = myId;
        that.id = socketId;
        that = this;
        startConnection.bind(that)(isInitiator);
    } else {
        throw "id can not be undefined";
    }
    
};
    
/*
    handle offer 
*/
DataChannel.prototype.onOffer = function(message) {
    var that = this;
    that.pc.setRemoteDescription(new RTCSessionDescription(message));
    createAnswer.bind(that)();
};

var createAnswer = function() {
    this.pc.createAnswer(setLocalAndSendMessage.bind(this), null, mediaConstraints);
};
    

DataChannel.prototype.addListener = function(type, listener){
    if (typeof this._listeners[type] == "undefined"){
        this._listeners[type] = [];
    }
    this._listeners[type].push(listener);
};
    
var fire = function(event, data){
    if (typeof event == "string"){
        event = { type: event };
    }
    if (!event.target){
        event.target = this;
    }
    
    event.data = data;

    if (!event.type){  //falsy
        throw new Error("Event object missing 'type' property.");
    }

    if (this._listeners[event.type] instanceof Array){
        var listeners = this._listeners[event.type];
        for (var i=0, len=listeners.length; i < len; i++){
            listeners[i].call(this, event);
        }
    }
};

DataChannel.prototype.removeListener = function(type, listener){
        if (this._listeners[type] instanceof Array){
            var listeners = this._listeners[type];
            for (var i=0, len=listeners.length; i < len; i++){
                if (listeners[i] === listener){
                    listeners.splice(i, 1);
                    break;
                }
            }
        }
};    
   
    
/*
    handle answer from another peer for given offer
*/
DataChannel.prototype.onAnswer = function(message) {
    this.pc.setRemoteDescription(new RTCSessionDescription(message));
};
    
/*
    handle on cadidate event 
*/
DataChannel.prototype.onCandidate = function(message) {
    var that = this;
    if(that.pc) {
        var candidate = new RTCIceCandidate({
            sdpMLineIndex:message.label,
            candidate:message.candidate
        });
        that.pc.addIceCandidate(candidate);
    }
};
    
DataChannel.prototype.sendData = function(message) {
    sendCommand.bind(this)(message);
};
    
/*
    create data channel for connection given name of channel
*/
DataChannel.prototype.createDataChannelFromName = function(name) {
    return this.createDataChannel(name);
};




/*
    it send data over data channel to peer on give dataChannel
*/
var sendDataOverDataChannel = function(localDataChannel, message) {
    var obj = {};
    obj.senderId = this.senderId;
    obj.receiverId = this.id;
    obj.data = message;
    obj = JSON.stringify(obj);
    localDataChannel.send(obj);
};

