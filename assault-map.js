/* Mission 1: original Forest Outpost, continuous northbound campaign map. */
(function(root){const MAP={width:800,height:3600,name:'FOREST OUTPOST / 森林前哨',solids:[
{x:60,y:3130,w:155,h:42,hp:8,type:'sandbag'},{x:590,y:2940,w:135,h:42,hp:8,type:'sandbag'},
{x:270,y:2800,w:95,h:45,hp:5,type:'crate'},{x:470,y:2800,w:95,h:45,hp:5,type:'crate'},
{x:50,y:2440,w:160,h:55,hp:10,type:'bunker'},{x:605,y:2270,w:140,h:55,hp:10,type:'bunker'},
{x:90,y:1560,w:130,h:60,hp:10,type:'bunker'},{x:600,y:1450,w:135,h:50,hp:8,type:'sandbag'},
{x:320,y:1100,w:75,h:45,hp:5,type:'crate'},{x:480,y:950,w:80,h:45,hp:5,type:'crate'},
{x:40,y:640,w:140,h:55,hp:10,type:'bunker'},{x:625,y:560,w:135,h:55,hp:10,type:'bunker'}],
water:{x:0,y:2050,w:800,h:140,bridge:{x:280,w:240}},
hostages:[{x:150,y:3220,type:'camp'},{x:650,y:2680,type:'cage'},{x:140,y:1780,type:'hut'},{x:650,y:1210,type:'bunker'},{x:220,y:610,type:'cage'}],
pickups:[{x:400,y:3260,type:'weapon'},{x:405,y:2900,type:'ammo'},{x:370,y:2460,type:'health'},{x:395,y:2220,type:'weapon'},{x:400,y:1970,type:'armor'},{x:365,y:1710,type:'ammo'},{x:400,y:1440,type:'weapon'},{x:420,y:1170,type:'health'},{x:405,y:850,type:'weapon'},{x:400,y:490,type:'ammo'}],
enemies:[['rifle',320,3080],['infantry',520,3080],['nest',400,2690],['rocket',620,2530],['light',270,2500],['turret',180,2210],['tank',380,1840],['rifle',610,1820],['mortar',170,1630],['armored',490,1390],['mine',330,2320],['mine',450,1610],['helicopter',420,1200],['rocket',610,1020],['nest',250,800],['rifle',500,710],['tank',400,560]]};root.AssaultMap=MAP;if(typeof module!=='undefined')module.exports=MAP;})(globalThis);