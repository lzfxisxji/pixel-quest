/* Fighting-only moves. P=punch, K=kick, S=special, U=ultimate. */
(function(root){'use strict';const move=(name,sequence,cost,damage,extra={})=>({name,sequence,cost,damage,...extra});
const COMBOS={
 explorer:[move('烈焰三连弹',['light','light','special'],30,4,{count:3,speed:440}),move('升龙顶击',['light','heavy','special'],35,15,{range:105,lift:370,dash:180})],
 soldier:[move('火力压制',['light','light','special'],30,2.5,{count:5,speed:540}),move('雷电脉冲',['light','heavy','special'],35,16,{speed:650,radius:22,effect:"lightning"})],
 mystic:[move('第三眼光波',['light','light','special'],30,15,{speed:480,radius:22,noReturn:true,effect:"wave"}),move('回旋追魂箭',['light','heavy','special'],35,8,{count:2,speed:380,returnArrow:true})],
 dora:[move('连发空气炮',['light','light','special'],30,6.5,{count:2,speed:460}),move('空气震荡波',['light','heavy','special'],35,15,{range:155,force:2.5})],
 goku:[move('残像突击',['light','light','special'],30,15,{range:110,dash:380,force:1.5}),move('蓄力龟派气功',['light','heavy','special'],35,18,{speed:590,radius:26,start:.3,effect:"beam"})],
 nezha:[move('双环追击',['light','light','special'],30,7.5,{count:2,speed:440}),move('混天绫缠打',['light','heavy','special'],35,16,{range:135,force:.4,lift:230})]
};
Object.assign(COMBOS,{astro:[move('原子连弹',['light','light','special'],30,6,{count:2,speed:480}),move('原子上勾拳',['light','heavy','special'],35,15,{range:105,lift:330})],happy:[move('机甲铁拳',['light','light','special'],30,14,{range:110,dash:180}),move('烈焰冲击拳',['light','heavy','special'],35,16,{range:125,force:1.7})],wuwa:[move('连发水流',['light','light','special'],30,6,{count:2,speed:460}),move('巨浪冲击',['light','heavy','special'],35,16,{speed:390,radius:24})]});
// Shared inputs, character-specific delivery and presentation.
const STYLES={
 explorer:{special:{effect:'fire'},ultimate:{effect:'star',range:170,dash:320,force:1.6}},
 soldier:{special:{effect:'bullet'},ultimate:{effect:'lightning',count:5,splitDamage:true,speed:680,radius:9}},
 mystic:{special:{effect:'arrow',returnArrow:true},ultimate:{effect:'eye',speed:470,radius:36}},
 dora:{special:{effect:'air'},ultimate:{effect:'air',speed:460,radius:42}},
 goku:{special:{effect:'beam',speed:590,radius:22},ultimate:{effect:'saiyan',speed:620,radius:34}},
 nezha:{special:{effect:'ring'},ultimate:{effect:'sash',range:190,force:.7}},
 astro:{special:{effect:'atomic'},ultimate:{effect:'atomicBeam',speed:700,radius:25}},
 happy:{special:{effect:'iron',range:110,dash:150},ultimate:{effect:'mecha',range:155,dash:280,force:2}},
 wuwa:{special:{effect:'water',speed:390},ultimate:{effect:'tidal',speed:340,radius:42}}
};
const effects={explorer:['fire','star'],soldier:['bullet','lightning'],mystic:['wave','arrow'],dora:['air','air'],goku:['afterimage','beam'],nezha:['ring','sash'],astro:['atomic','atomicFist'],happy:['iron','mecha'],wuwa:['water','tidal']};
for(const [id,moves] of Object.entries(COMBOS)){
 moves.forEach((m,i)=>m.effect=effects[id][i]);
 moves.push(move({explorer:'无敌星光突进',soldier:'雷霆全弹齐射',mystic:'第三眼觉醒',dora:'超级空气炮',goku:'超级赛亚人龟派气功',nezha:'混天绫风暴',astro:'原子光炮爆发',happy:'超级机甲烈焰拳',wuwa:'滔天巨浪'}[id],['light','heavy','ultimate'],100,26,{radius:38,speed:570,...STYLES[id].ultimate}));
}
const api={COMBOS,STYLES};root.PixelFightingCombos=api;if(typeof module==='object')module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
