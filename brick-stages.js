/* Fifteen handcrafted original layouts. n normal / h reinforced / s steel / b bonus / x blast. */
(function(root){const stages=[
{name:'彩虹启航',rows:['nnnnnnnnnn','nnnnnnnnnn','nnbnnnnbnn','nnnnnnnnnn']},
{name:'折线阶梯',rows:['n........n','nn......nn','nbn....nbn','nnnn..nnnn','.nnnnnnnn.','..nnnnnn..']},
{name:'菱形花园',rows:['....nn....','...nbbn...','..nn..nn..','.nn....nn.','nn......nn','.nn....nn.','..nnbbnn..','...nnnn...']},
{name:'双层城墙',rows:['hhhhhhhhhh','nnnnnnnnnn','hh..hh..hh','nbnnnnnnbn','.hh....hh.','..nnnnnn..']},
{name:'双塔回声',rows:['.hh....hh.','.hb....bh.','.hn....nh.','.hh....hh.','nnn....nnn','nnb....bnn','hhhh..hhhh']},
{name:'交错齿轮',rows:['hnhnhnhnhn','nhnhnhnhnh','nn..bb..nn','.hh.nn.hh.','nn..hh..nn','.nb.nn.bn.','..hhhhhh..']},
{name:'钢铁航道',rows:['nnnnhhnnnn','.bnn..nnb.','nsnn..nnsn','nsnhbbhnsn','nsnn..nnsn','.nxx..xxn.','..nnnnnn..']},
{name:'连锁星火',rows:['...hhhh...','..nxbbxn..','.nxnnnnxn.','nbnh..hnbn','.nxnnnnxn.','..nxxxxn..','...nbbn...']},
{name:'铆钉迷阵',rows:['hnhnhnhnhn','nbnsnnsnbn','nsnnxxnnsn','nnnsnnsnnn','.hnbxxbnh.','nsnn..nnsn','nnnnnnnnnn']},
{name:'移动光桥',rows:['nnnbhhbnnn','hh..nn..hh','.nnxbbxnn.','nn..hh..nn','.hhxxxxhh.','nnnb..bnnn'],obstacles:[{x:240,y:360,w:130,h:12,range:145,rate:1.1}]},
{name:'双闸回旋',rows:['hhh....hhh','nnbn..nbnn','.snnxxnns.','hhnb..bnhh','.nnxxxxnn.','nbnn..nnbn','..hhhhhh..'],obstacles:[{x:155,y:350,w:100,h:12,range:95,rate:1.35},{x:380,y:410,w:100,h:12,range:95,rate:1.35,phase:Math.PI}]},
{name:'折射工坊',rows:['hhsnhhnshh','nnnb..bnnn','hsnxnnxnsh','.nnhbbhnn.','nbnnssnnbn','.hhxxxxhh.','nnnn..nnnn'],obstacles:[{x:260,y:390,w:120,h:14,range:180,rate:1.25}]},
{name:'水晶棱堡',rows:['hbhh..hhbh','nhsnxxnshn','hhnnssnnhh','.bnhhhhnb.','nnxx..xxnn','hnsnhhnsnh','.nhbxxbhn.','..hhhhhh..']},
{name:'碎裂轨道',rows:['xhnnbbnnhx','nhsnnnnshn','hhxx..xxhh','nbnhsshnbn','xhnnnnnnhx','.hhbbbbhh.','nnsn..nsnn','hh..xx..hh'],obstacles:[{x:250,y:410,w:140,h:12,range:165,rate:1.55}]},
{name:'终极反弹',rows:['hbhxhhxhbh','nhsnhhnshn','xxnhbbhnxx','hsnxxxxnsh','nbhnssnhbn','hhxxbbxxhh','.nhhhhhhn.','nnxb..bxnn','hhnn..nnhh'],obstacles:[{x:200,y:415,w:95,h:12,range:115,rate:1.7},{x:355,y:470,w:95,h:12,range:115,rate:1.7,phase:Math.PI}]}
];root.BrickStages=stages;if(typeof module!=='undefined')module.exports=stages})(globalThis);
