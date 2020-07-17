'use strict';
require('dotenv').config();

const ytdl = require('ytdl-core');                  // Library for downloading video on YouTube
let { getData } = require("spotify-url-info");      // Method for getting very basic data from Spotify song
const youtubeSearch = require('youtube-search');    // Library for searching video on YouTube using song title
const Discord = require('discord.js');
const bot = new Discord.Client();
const { Client, MessageAttachment } = require('discord.js');
const TOKEN = process.env.TOKEN_BOT;               //
const TOKEN_YT = process.env.TOKEN_YT;             // Secure 
const musicChannelID = process.env.MUSIC_CHANNEL;  //       data
const musicLog = process.env.MUSIC_LOG;            //

let server; // var for specific user info depending on id
let spotiURL = 'https://open.spotify.com/track/';
let servers = {};
let songsList = [];

bot.on('message', async (message) => {

  let args = message.content.split(" ");
  const voiceChannel = message.member.voice.channel || {id: 0};
  
  switch(args[0]) {
    case '!play':
      message.delete();
      let link = args[1];

      function play(connection, message) {
        let server = servers[message.guild.id];
        let link = server.queue[0] || null;
        // if there is no link in queue than won't play anymore
        if (!link) return;
   
        let song = {};
        let songsInQueue = server.queue.length;
  
        server.dispatcher = connection.play(ytdl(link, {
          filter: "audioonly", 
          highWaterMark: 1 << 25 // adding this line fixes ending video
                                 // before dispatcher "finish" event
        }));

        ytdl.getInfo(link, (err, info) => {
          if (err) console.log('Some bug with getting info about video.');
 
          song.title = info.title;
          song.lengthSeconds = info.lengthSeconds;
          song.customer = message.member.nickname;

          // if we already played song than do nothing with music-log 
          if (songsList.some(song => song.title === info.title)) return;
          songsList.push(song);
          
          bot.channels.cache.get(`${musicLog}`).send(
            `:musical_note: ${song.title}\nЗаказал: ${song.customer}\nПесен в очереди: ${songsInQueue}`);
        });
        
        server.dispatcher.on("finish", () => {
          server.queue.shift();
          if (link) play(connection, message);
          else connection.disconnect();
        });
      }

      if (!link) {
        message.channel.send('Необходимо указать ссылку вторым аргументом после "!play"');
        return;
      }
      
      if (!voiceChannel) {
        message.channel.send('Необходимо находиться в канале "music allowed"');
        return;
      }

      if (voiceChannel.id !== musicChannelID) {
        message.channel.send('Необходимо находиться в канале "music allowed"');
        return;
      }

      if (!servers[message.guild.id]) servers[message.guild.id] = {
        queue: [],
      };
      
      server = servers[message.guild.id];

      // if provided link relates to Spotify
      if (link.startsWith(spotiURL)) {

        let spotiData = await getData(link);
        let author = spotiData.artists[0].name;
        let song = spotiData.name;

        // for YouTube search
        let opts = {
          maxResults: 1,
          key: TOKEN_YT,
        };

        let ytLink;
        youtubeSearch(`${author} ${song}`, opts, 
                  (err, results) => {
                    if (err) return console.log(err);

                    ytLink = results[0].link;
                    server.queue.push(ytLink);

                    if (!message.guild.voiceConnection) voiceChannel.join().then(connection => play(connection, message));            
                  });
      // if link is YouTube video
      } else { 

        server.queue.unshift(link);

        if (!message.guild.voiceConnection) voiceChannel.join().then(connection => play(connection, message));
      }
    break;

    case '!pause':
      message.delete();
      server = servers[message.guild.id];
      if (server.dispatcher) server.dispatcher.pause();
    break;

    case '!resume':
      message.delete();
      server = servers[message.guild.id];
      if (server.dispatcher) server.dispatcher.resume();
    break;

    case '!skip':
      message.delete();
      server = servers[message.guild.id];
      if (server.dispatcher) server.dispatcher.end();
    break;

    // FIX ME ↓
    case '!stop':
      message.delete();
      server = servers[message.guild.id];
    
      if (message.guild.voiceConnection) {
        server.queue = [];

        server.dispatcher.end();
        console.log('\n stopped the queue!');
      }

      if (message.guild.connection) message.guild.voiceConnection.disconnect();
    break;
    // FIX ME ↑

    case 'vlad':
    case 'pasha':
      message.delete();
      const attachment = new MessageAttachment(`./images/${args[0]}.jpg`);
      message.channel.send('Я крутой', attachment);
    break;
  }
});

bot.on('ready', () => {
  console.log('Bot Started!');
});

bot.login(TOKEN);