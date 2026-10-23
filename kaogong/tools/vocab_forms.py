# -*- coding: utf-8 -*-
"""
vocab_forms.py — 英语角词条「词形变化」生成器 + 「形近词」清洗器（考公英语角模块专用）
=====================================================================================
用途（2026-10-18 西瓜需求）：
  1. 为每个词生成 forms（词形变化）：{n:[名词派生], v:[动词形态], adj:[形容词派生/形态], adv:[副词派生], pl:[复数]}
     例：provide -> v: provides/provided/providing, n: provision, adj: provisional
         go      -> v: goes/went/gone/going
         child   -> pl: children
         central -> adv: centrally, v: centralize/centralized/centralizing, n: centralization
  2. 清洗 rel.form：只保留「形态相似但意思不同」的真·形近异义词（如 metal→medal/mental/petal，
     desert→dessert），把词态/词族/派生项移入 forms 或删除；拿不准的一律删除（宁缺毋滥）。
  3. 供每日 cron 生成新英语角词条时复用：from vocab_forms import enrich_word

原则：只输出高置信词形；不规则变化必须准确（go/went/gone、child/children、good/better/best）；
     派生词宁可不出，不可出错。w/ph/cn/eg/egCn/rel.sound/rel.syn 一律不动。
"""
from __future__ import print_function
import re, json

# ---------------------------------------------------------------------------
# 1) 不规则动词：base -> (过去式, 过去分词)；现在分词/三单由规则引擎处理
# ---------------------------------------------------------------------------
IRREG_V = {
 'arise':('arose','arisen'),'awake':('awoke','awoken'),'be':('was/were','been'),'bear':('bore','borne'),
 'beat':('beat','beaten'),'become':('became','become'),'begin':('began','begun'),'bend':('bent','bent'),
 'bet':('bet','bet'),'bind':('bound','bound'),'bite':('bit','bitten'),'bleed':('bled','bled'),
 'blow':('blew','blown'),'break':('broke','broken'),'bring':('brought','brought'),'broadcast':('broadcast','broadcast'),
 'build':('built','built'),'burn':('burnt/burned','burnt/burned'),'burst':('burst','burst'),'buy':('bought','bought'),
 'cast':('cast','cast'),'catch':('caught','caught'),'choose':('chose','chosen'),'come':('came','come'),
 'cost':('cost','cost'),'cut':('cut','cut'),'deal':('dealt','dealt'),'dig':('dug','dug'),
 'do':('did','done'),'draw':('drew','drawn'),'dream':('dreamt/dreamed','dreamt/dreamed'),'drink':('drank','drunk'),
 'drive':('drove','driven'),'eat':('ate','eaten'),'fall':('fell','fallen'),'feed':('fed','fed'),
 'feel':('felt','felt'),'fight':('fought','fought'),'find':('found','found'),'fly':('flew','flown'),
 'forbid':('forbade','forbidden'),'forget':('forgot','forgotten'),'forgive':('forgave','forgiven'),'freeze':('froze','frozen'),
 'get':('got','got/gotten'),'give':('gave','given'),'go':('went','gone'),'grow':('grew','grown'),
 'hang':('hung','hung'),'have':('had','had'),'hear':('heard','heard'),'hide':('hid','hidden'),
 'hit':('hit','hit'),'hold':('held','held'),'hurt':('hurt','hurt'),'keep':('kept','kept'),
 'kneel':('knelt','knelt'),'know':('knew','known'),'lay':('laid','laid'),'lead':('led','led'),
 'learn':('learnt/learned','learnt/learned'),'leave':('left','left'),'lend':('lent','lent'),'let':('let','let'),
 'lie':('lay','lain'),'light':('lit','lit'),'lose':('lost','lost'),'make':('made','made'),
 'mean':('meant','meant'),'meet':('met','met'),'mistake':('mistook','mistaken'),'overcome':('overcame','overcome'),
 'pay':('paid','paid'),'prove':('proved','proved/proven'),'put':('put','put'),'quit':('quit','quit'),
 'read':('read','read'),'rid':('rid','rid'),'ride':('rode','ridden'),'ring':('rang','rung'),
 'rise':('rose','risen'),'run':('ran','run'),'say':('said','said'),'see':('saw','seen'),
 'seek':('sought','sought'),'sell':('sold','sold'),'send':('sent','sent'),'set':('set','set'),
 'shake':('shook','shaken'),'shoot':('shot','shot'),'show':('showed','shown'),'shut':('shut','shut'),
 'sing':('sang','sung'),'sink':('sank','sunk'),'sit':('sat','sat'),'sleep':('slept','slept'),
 'slide':('slid','slid'),'speak':('spoke','spoken'),'spend':('spent','spent'),'spread':('spread','spread'),
 'stand':('stood','stood'),'steal':('stole','stolen'),'stick':('stuck','stuck'),'strike':('struck','struck'),
 'swear':('swore','sworn'),'sweep':('swept','swept'),'swim':('swam','swum'),'take':('took','taken'),
 'teach':('taught','taught'),'tear':('tore','torn'),'tell':('told','told'),'think':('thought','thought'),
 'throw':('threw','thrown'),'understand':('understood','understood'),'wake':('woke','woken'),'wear':('wore','worn'),
 'weave':('wove','woven'),'weep':('wept','wept'),'win':('won','won'),'wind':('wound','wound'),
 'withdraw':('withdrew','withdrawn'),'write':('wrote','written'),
}
# 末尾单辅音双写（过去式/现在分词）的常用动词白名单
DOUBLE_LAST = set('stop plan rub beg drop fit nod hug pat shop hop dim log map nap rip rob skip slap slip step stir'
                  'wrap chat clap drum grin grab grip jab jog knit mop'.split())
DOUBLE_LAST |= {'travel','cancel','model','signal','label','quarrel','control','occur','prefer','refer','admit','commit',
                'permit','forget','begin','run','swim','sit','put','cut','hit','let','set','shut','spin','win','knot','step'}

# ---------------------------------------------------------------------------
# 2) 不规则名词复数 / 不规则形容词比较级最高级 / 常见单音节形容词（-er/-est）
# ---------------------------------------------------------------------------
IRREG_N = {'child':'children','man':'men','woman':'women','person':'people','foot':'feet','tooth':'teeth',
 'goose':'geese','mouse':'mice','ox':'oxen','sheep':'sheep','deer':'deer','fish':'fish','cattle':'cattle',
 'datum':'data','medium':'media','criterion':'criteria','analysis':'analyses','basis':'bases','crisis':'crises',
 'phenomenon':'phenomena','curriculum':'curricula','index':'indexes/indices','leaf':'leaves','life':'lives',
 'knife':'knives','wife':'wives','half':'halves','self':'selves','shelf':'shelves','wolf':'wolves','thief':'thieves',
 'hero':'heroes','potato':'potatoes','tomato':'tomatoes','echo':'echoes','negro':'negroes'}
IRREG_ADJ = {'good':('better','best'),'well':('better','best'),'bad':('worse','worst'),'ill':('worse','worst'),
 'many':('more','most'),'much':('more','most'),'little':('less','least'),'far':('farther','farthest'),
 'old':('older/elder','oldest/eldest')}
SHORT_ADJ = {'big','hot','sad','red','glad','thin','fat','wet','mad','new','young','cold','warm','tall','short',
 'long','fast','slow','high','low','hard','soft','thick','strong','weak','bright','dark','wide','deep','cheap',
 'dear','near','rich','poor','clean','clear','great','small','large','kind','proud','sharp','smooth','loud',
 'quiet','quick','slow1','narrow','simple','noble','gentle','humble','able','busy','easy','happy','heavy',
 'lucky','pretty','sorry','funny','angry','hungry','dirty','crazy','early','lovely','friendly','costly',
 'lonely','daily','lively','elderly','deadly'}
SHORT_ADJ -= {'slow1','narrow','simple','noble','gentle','humble','able','lovely','friendly','costly','lonely',
 'daily','lively','elderly','deadly'}  # 多音节/派生的 -ly 形容词不用 -er/-est
# 上面 set 减法：narrow/simple 等多音节不属于单音节，去掉后 SHORT_ADJ 保持单音节集合

# ---------------------------------------------------------------------------
# 3) 高置信后缀派生规则：word -> {n/v/adj/adv 补充}（仅当词干形态直接命中）
# ---------------------------------------------------------------------------
SUFFIX_RULES = [
 # (词性匹配, 后缀正则, 目标词性, 变换函数)
 ('adj','able$','n',  lambda w: w[:-4]+'ability'),
 ('adj','able$','adv',lambda w: w[:-4]+'ably'),
 ('adj','ible$','n',  lambda w: w[:-4]+'ibility'),
 ('adj','ible$','adv',lambda w: w[:-4]+'ibly'),
 ('adj','ful$','adv', lambda w: w[:-1]+'ly'),
 ('adj','ous$','adv', lambda w: w[:-1]+'ly'),
 ('adj','ive$','adv', lambda w: w[:-1]+'ly'),
 ('adj','al$','adv',  lambda w: w+'ly'),
 ('adj','ic$','adv',  lambda w: w[:-2]+'ically'),
 ('adj','y$','n',     lambda w: w[:-1]+'iness'),
 ('adj','y$','adv',   lambda w: w[:-1]+'ily'),
 ('adj','less$','adv',lambda w: w+'ly'),
 ('adj','less$','n',  lambda w: w+'ness'),
 ('adj','le$','adv',  lambda w: w[:-2]+'ly'),
 ('adj','ent$','n',   lambda w: w[:-2]+'ence'),
 ('adj','ant$','n',   lambda w: w[:-2]+'ance'),
 ('n','tion$','adj',  lambda w: w+'al'),
 ('n','ment$','adj',  lambda w: w[:-3]+'mental'),
 ('n','ness$','adj',  lambda w: w+'ful'),
 ('v','ate$','n',     lambda w: w[:-1]+'ion'),
 ('v','ize$','n',     lambda w: w[:-1]+'ation'),
 ('v','ify$','n',     lambda w: w[:-1]+'ication'),
 ('v','ise$','n',     lambda w: w[:-1]+'ation'),
 ('v','ise$','v',     lambda w: w[:-1]+'ization'),
]

# ---------------------------------------------------------------------------
# 4) curated 特殊派生（规则覆盖不到的高频派生；宁缺毋滥，只列确定的）
#    base -> {'n':[...], 'v':[...], 'adj':[...], 'adv':[...]}
# ---------------------------------------------------------------------------
DERIV = {
 'provide':{'n':['provision'],'adj':['provisional']},
 'decide':{'n':['decision'],'adj':['decisive']},
 'value':{'n':['valuation'],'adj':['valuable','valueless']},
 'available':{'n':['availability']},
 'desire':{'adj':['desirable']},
 'central':{'n':['centralization'],'v':['centralize','centralized','centralizing'],'adv':['centrally']},
 'protect':{'n':['protection'],'adj':['protective']},
 'treat':{'n':['treatment'],'adj':['treatable']},
 'appear':{'n':['appearance','disappearance'],'v':['disappear']},
 'grateful':{'n':['gratitude']},
 'capable':{'n':['capability','capacity']},
 'govern':{'n':['government','governor'],'adj':['governmental']},
 'perform':{'n':['performance','performer']},
 'remove':{'n':['removal'],'adj':['removable']},
 'desert':{'adj':['deserted']},
 'illegal':{'n':['illegality'],'adv':['illegally']},
 'curious':{'n':['curiosity'],'adv':['curiously']},
 'formal':{'n':['formality'],'adv':['formally'],'v':['formalize']},
 'arrive':{'n':['arrival']},
 'decent':{'n':['decency'],'adv':['decently']},
 'friend':{'n':['friendship'],'adj':['friendly']},
 'desperate':{'n':['desperation'],'adv':['desperately']},
 'flower':{'v':['flowered','flowering'],'adj':['flowery']},
 'dramatic':{'v':['dramatize','dramatized','dramatizing'],'adv':['dramatically']},
 'refuse':{'n':['refusal']},
 'solve':{'n':['solution'],'adj':['solvable']},
 'proper':{'adv':['properly'],'n':['property']},
 'false':{'n':['falsity'],'adv':['falsely'],'v':['falsify','falsified','falsifying']},
 'intelligence':{'adj':['intelligent']},
 'borrow':{'n':['borrower','borrowing']},
 'popular':{'n':['popularity','population'],'v':['popularize'],'adv':['popularly']},
 'presence':{'n':['presentation']},
 'technology':{'adj':['technological'],'n':['technologist']},
 'precious':{'adv':['preciously']},
 'material':{'adj':['materialistic']},
 'exchange':{'adj':['exchangeable']},
 'convince':{'n':['conviction'],'adj':['convinced','convincing'],'adv':['convincingly']},
 'beast':{'adj':['beastly']},
 'ordinary':{'adv':['ordinarily']},
 'success':{'adj':['successful'],'v':['succeed'],'adv':['successfully']},
 'separate':{'n':['separation'],'adv':['separately'],'adj':['separated']},
 'exact':{'adv':['exactly']},
 'expert':{'n':['expertise']},
 'direct':{'n':['direction','director'],'adv':['directly']},
 'receive':{'n':['receipt','reception','receiver']},
 'series':{'adj':['serial']},
 'section':{'adj':['sectional']},
 'juice':{'adj':['juicy']},
 'tower':{'adj':['towering']},
 'schedule':{'adj':['scheduled']},
 'wheel':{'v':['wheeled','wheeling'],'adj':['wheeled']},
 'cigarette':{'n':['cigar']},
 'fruit':{'adj':['fruity','fruitful']},
 'sacrifice':{'adj':['sacrificial']},
 'range':{'adj':['ranging']},
 'button':{'v':['buttoned','buttoning']},
 'effort':{'adj':['effortless'],'adv':['effortlessly']},
 'youth':{'adj':['youthful']},
 'garage':{'v':['garaged','garaging']},
 'progress':{'adj':['progressive'],'n':['progression']},
 'unusual':{'adv':['unusually']},
 'campaign':{'v':['campaigned','campaigning'],'n':['campaigner']},
 'vision':{'adj':['visual'],'v':['visualize','visualized','visualizing']},
 'route':{'v':['routed','routing']},
 'defend':{'n':['defense','defence','defendant'],'adj':['defensive'],'adv':['defensively']},
 'trace':{'n':['tracing'],'adj':['traceable']},
 'nasty':{'n':['nastiness'],'adv':['nastily']},
 'merry':{'n':['merriment'],'adv':['merrily']},
 'senior':{'n':['seniority']},
 'freeze':{'n':['freezer','freezing'],'adj':['frozen']},
 'incident':{'adj':['incidental']},
 'snake':{'adj':['snaky']},
 'actor':{'n':['actress']},
 'sentence':{'v':['sentenced','sentencing'],'adj':['sentenced']},
 'friendly':{'n':['friendliness']},
 'charming':{'adv':['charmingly']},
 'anger':{'adj':['angry'],'adv':['angrily'],'v':['angered','angering']},
 'sharp':{'v':['sharpen','sharpened','sharpening'],'n':['sharpness'],'adv':['sharply']},
 'shadow':{'adj':['shadowy'],'v':['shadowed','shadowing']},
 'shoulder':{'v':['shouldered','shouldering']},
 'negative':{'n':['negativity'],'adv':['negatively']},
 'screen':{'v':['screened','screening']},
 'similar':{'n':['similarity'],'adv':['similarly']},
 'chain':{'v':['chained','chaining'],'adj':['chained']},
 'collect':{'n':['collection','collector'],'adj':['collective'],'adv':['collectively']},
 'passion':{'adj':['passionate'],'adv':['passionately']},
 'empire':{'adj':['imperial']},
 'international':{'v':['internationalize'],'adv':['internationally']},
 'curse':{'adj':['cursed']},
 'design':{'n':['designer']},
 'thunder':{'adj':['thunderous'],'adv':['thunderously']},
 'object':{'adj':['objective'],'adv':['objectively'],'n':['objection']},
 'politics':{'adj':['political','politician']},
 'alcohol':{'adj':['alcoholic'],'n':['alcoholism']},
 'climb':{'n':['climber','climbing']},
 'fashion':{'adj':['fashionable'],'adv':['fashionably']},
 'prize':{'v':['prized','prizing'],'adj':['prized']},
 'circle':{'adj':['circular'],'v':['circulate','circulated','circulating'],'n':['circulation']},
 'approach':{'adj':['approachable']},
 'stock':{'v':['stocked','stocking'],'adj':['stocked']},
 'percent':{'n':['percentage']},
 'education':{'adj':['educational']},
 'library':{'n':['librarian']},
 'authority':{'v':['authorize','authorized','authorizing'],'n':['authorization'],'adj':['authoritative']},
 'current':{'adv':['currently'],'n':['currency']},
 'glory':{'adj':['glorious'],'adv':['gloriously']},
 'border':{'v':['bordered','bordering'],'adj':['borderless']},
 'reputation':{'adj':['reputable'],'adv':['reputably']},
 'confidence':{'adj':['confident'],'adv':['confidently']},
 'actual':{'adv':['actually'],'n':['actuality']},
 'mental':{'adv':['mentally'],'n':['mentality']},
 'flesh':{'adj':['fleshy']},
 'secure':{'n':['security'],'adj':['secured'],'adv':['securely']},
 'federal':{'n':['federation'],'adv':['federally']},
 'emotional':{'adv':['emotionally']},
 'reward':{'v':['rewarded','rewarding'],'adj':['rewarding']},
 'commit':{'n':['commitment'],'adj':['committed']},
 'extraordinary':{'adv':['extraordinarily']},
 'opposite':{'adv':['oppositely']},
 'detail':{'adj':['detailed']},
 'agreement':{'adj':['agreeable'],'adv':['agreeably']},
 'culture':{'adj':['cultural'],'adv':['culturally']},
 'saint':{'adj':['saintly'],'n':['sainthood']},
 'solid':{'n':['solidity'],'adv':['solidly']},
 'intend':{'n':['intention'],'adj':['intentional'],'adv':['intentionally']},
 'ignore':{'n':['ignorance'],'adj':['ignorant']},
 'useful':{'adv':['usefully'],'n':['usefulness'],'adj':['useless']},
 'attempt':{'v':['attempted','attempting']},
 'guarantee':{'v':['guaranteed','guaranteeing']},
 'gather':{'n':['gathering'],'v':['gathered','gathering']},
 'violent':{'n':['violence'],'adv':['violently']},
 'disaster':{'adj':['disastrous'],'adv':['disastrously']},
 'revolution':{'adj':['revolutionary']},
 'terrific':{'adv':['terrifically']},
 'impressive':{'adv':['impressively']},
 'potential':{'adv':['potentially']},
 'advance':{'adj':['advanced'],'n':['advancement']},
 'miserable':{'n':['misery']},
 'steady':{'n':['steadiness'],'adv':['steadily']},
}
EXTRA_DERIV = {}

# ---------------------------------------------------------------------------
# 5) 形近异义词白名单（真·形近：拼写相似、意思不同；宁缺毋滥）
#    w -> [与之形近的其他词]（均为真实英语词）
# ---------------------------------------------------------------------------
CONFUSABLE = {
 'available':['avoidable'],'factory':['factor','faculty'],'value':['valve'],'central':['sentinel'],
 'union':['unit','onion'],'mirror':['error','minor','miracle'],'desire':['despair'],'monkey':['money','donkey'],
 'pride':['prize'],'miracle':['mirror','marvel'],'Christian':['Christmas'],
 'protection':['protest','projection'],'treatment':['treaty','retreat','argument'],'metal':['medal','mental','petal'],
 'disappear':['disappoint','despair'],'grateful':['grate','great'],'extremely':['externally'],
 'treasure':['measure','pleasure'],'rescue':['secure','recourse'],'capable':['cape','cable'],
 'result':['insult','consult'],'governor':[],'remove':['move','remote'],
 'performance':['performer'],'scream':['cream','screen','stream'],'desert':['dessert'],
 'vehicle':['vessel'],'illegal':['legal','illegible'],'curious':['serious'],
 'candy':['candle','candidate','candid'],'former':['formal','latter'],'holiday':['holy'],
 'arrive':['derive','rival'],'remains':['reminder','maintains'],'decent':['descend','descent'],
 'penny':[],'claim':['exclaim','proclaim','acclaim'],'friendship':['hardship','fellowship'],
 'desperate':['despair','despise'],'flower':['flour','flora'],'dramatic':['drastic','dramatist'],
 'refuse':['reuse','confuse'],'solve':['resolve','dissolve'],'proper':['prosper','propose'],
 'mostly':['almost','monster'],'directly':['directory','dirty'],'surface':['surf','surpass'],
 'false':['fault','fall'],'junior':['senior','major'],'germany':['geometry'],
 'punch':['pinch'],'africa':['america'],'intelligence':['intellect'],
 'borrow':['burrow','sorrow'],'popular':['poplar','populous'],'announcer':['noun'],
 'stranger':['strangle','danger'],'presence':['peasants'],'technology':['technique','technician'],
 'toast':['roast','coast','boast'],'april':['apron','appal'],'precious':['previous','precocious'],
 'coast':['roast','toast'],'material':['maternal','materialist'],'uniform':['unify','inform'],
 'exchange':['charge'],'convince':['convict','conscience'],'beast':['breast','feast'],
 'ordinary':['ornate','ordinal'],'success':['successor'],'japan':['jumper'],
 'creature':['creator','cater'],'fourth':['forth','forty'],'separate':['desperate'],
 'shift':['shaft','swift'],'exact':['exit','enact'],'expert':['expect','export'],
 'direct':['director','erect'],'score':['scare','scone'],'twenty':['twelve','twin'],
 'receive':['conceive','deceive'],'series':['serious'],'section':['sector','seduction'],
 'pilot':['plot'],'grade':['grape','grate'],'juice':['just'],
 'tower':['toward','towel'],'solution':['resolution'],'schedule':['scheme'],
 'explosion':['exploration'],'wheel':['heel','whale'],'cigarette':['cigar'],
 'fruit':['fright'],'sacrifice':['sacred'],'range':['orange','arrange'],
 'button':['baton','mutton'],'prisoner':['poisoner'],'effort':['afford'],
 'youth':['yacht'],'garage':['garbage','gauge'],'ambulance':['ambiance','ramble'],
 'progress':['process','program'],'unusual':['usage'],'county':['country','count'],
 'campaign':['champion','companion'],'vision':['version','division'],'reporter':['resort'],
 'equipment':[],'route':['routine'],'defend':['depend'],'trace':['truce'],
 'nasty':['hasty','tasty'],'magazine':['machine'],'merry':['marry','mercy'],
 'senior':['sensor'],'freeze':['frieze','sneeze'],'emperor':['employer'],
 'incident':['accident'],'snake':['snack','brake'],'actor':['factor','author'],
 'newspaper':['newsreel'],'sentence':['sentiment','sensitive'],'leading':['leaning'],
 'friendly':[],'charming':['charring'],'anger':['angel'],
 'learning':['leaning','earning'],'sharp':['shark'],'shadow':['shallow'],
 'elevator':[],'kingdom':[],'shoulder':['shudder'],
 'sometime':['somewhat','somewhere'],'attitude':['altitude','aptitude'],
 'negative':['neglect','negotiate'],'screen':['scream'],'similar':['simile','familial'],
 'understanding':['standing'],'chain':['chair'],'collect':['correct','connect'],
 'passion':['pension','session'],'writer':['winter','waiter'],'empire':['umpire','aspire'],
 'international':['internal'],'curse':['cause','course'],'device':['devise','advice'],
 'design':['assign','resign'],'movement':['moment','monument'],'thunder':['blunder'],
 'object':['subject','reject'],'politics':['polite','policy'],'despite':['despise'],
 'alcohol':['abroad'],'climb':[],'conference':['difference'],
 'provide':['providence'],'valley':['volley','alley'],'fashion':['fascination','ration'],
 'prize':['price','praise'],'previously':['precise'],'circle':['circus','cycle'],
 'approach':['approval','reproach'],'stock':['stack','stork'],'percent':['parent'],
 'normally':['enormously'],'education':['dedication','edification'],'library':['liberty'],
 'authority':['author','authenticity'],'current':['currant'],'failure':['familiar','flare'],
 'glory':['flora'],'agency':['agenda'],'apple':['dapple'],
 'border':['boarder','bother'],'reputation':['repetition'],'confidence':['confidant','conference'],
 'beloved':['below','behave'],'actual':['virtual'],'mental':['medal','mettle'],
 'flesh':['fresh','flush'],'secure':['secular'],'highly':['hilly'],
 'federal':['funeral','general'],'emotional':[],'setting':['sitting'],
 'robbery':['rubbish'],'reward':['award','regard'],'commit':['summit'],
 'extraordinary':[],'opposite':['apposite'],'detail':['detain','retail'],
 'background':[],'garbage':['garb'],'agreement':['argument'],
 'ability':['agility'],'tiger':[],'culture':['agriculture'],
 'saint':['stain'],'solid':['sold','solemn'],'intend':['intern'],
 'district':['distinct','distract'],'ignore':['ignite'],'naturally':['actually'],
 'useful':['usage'],'attempt':['tempt'],'guarantee':['guardian','warrant'],
 'gather':['rather'],'policy':['police','politics'],'violent':['violet'],
 'childhood':[],'disaster':['diameter','distaste'],'revolution':['revelation','evolution'],
 'heavily':['heaven'],'terrific':['terrible'],'impressive':['express'],
 'potential':['potent','substantial'],'committee':['community'],'dozen':[],
 'delivery':['livery'],'advance':['advantage'],
}
EXTRA_CONFUSABLE = {
 'assist':['persist','resist','consist'],
 'sickness':['thickness'],
 'seventh':['seventeen'],
 'float':['flour','fleet'],
 'curiosity':['courtesy'],
 'glove':['globe'],
 'greedy':['greasy'],
 'autumn':['album','atom'],
 'contain':['content'],
 'receipt':['recipe'],
 'bounce':['bound'],
 'unlikely':['unlike'],
 'colony':['colonel','colon'],
 'volume':['column'],
 'engage':['enrage'],
 'violet':['violent','violate'],
 'mutual':['mutton'],
 'harvest':['harsh','harrow'],
 'poverty':['property','poetry'],
 'ambition':['ambient'],
 'ankle':['angle'],
 'draft':['drift'],
 'factor':['factory','faculty'],
 'portrait':['portion','portray'],
 'reserve':['preserve'],
 'logical':['logistics'],
 'eliminate':['elevate'],
 'carbon':['carbide'],
 'independence':['dependence'],
 'medium':['median'],
 'memorial':['memorable'],
 'earthquake':['earthwork'],
 'involve':['evolve','revolve'],
 'reliable':['liable'],
 'indicate':['dedicate'],
 'swamp':['swarm'],
 'manual':['annual'],
 'compound':['compost'],
}

# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------
def _strip_gloss(s):
    """把 'avail（v. 有益于；n. 效用）' / 'dessert（甜点）' 归一为纯英文单词"""
    s = re.sub(r'[（(].*$', '', str(s))
    s = re.sub(r'[\s\-/]+', ' ', s).strip()
    return s

SUPPRESS_ADV = {'available','junior','senior','leading','beloved','bound','unknown','mobile','plastic',
 'nuclear','friendly','everyday','underground','jewish','sacred','holy','holy1'}  # 罕见/不地道的 -ly 副词，宁缺毋滥
SUPPRESS_N = {'valuability','miserability'}  # 生僻派生名词，宁缺毋滥

def _dedupe(seq):
    out = []
    for x in seq:
        if x and x not in out:
            out.append(x)
    return out

def _v3(w):
    if w.endswith(('s','x','z','ch','sh','o')): return w+'es'
    if w.endswith('y') and len(w)>1 and w[-2] not in 'aeiou': return w[:-1]+'ies'
    return w+'s'

def _ved(w):
    """过去式/过去分词（规则路径；不规则词在调用前已短路）"""
    if w in IRREG_V: return IRREG_V[w][0]
    if w.endswith('e'): return w+'d'
    if w.endswith('y') and len(w)>1 and w[-2] not in 'aeiou': return w[:-1]+'ied'
    if w in DOUBLE_LAST: return w+w[-1]+'ed'
    return w+'ed'

def _ving(w):
    if w in IRREG_V:  # 现在分词都是规则的（be→being 单独处理）
        pass
    if w=='be': return 'being'
    if w.endswith('ie'): return w[:-2]+'ying'
    if w.endswith('e') and not w.endswith(('ee','ye','oe')): return w[:-1]+'ing'
    if w in DOUBLE_LAST: return w+w[-1]+'ing'
    return w+'ing'

def verb_forms(w):
    """动词的词形变化（三单/过去/过去分词/现在分词）"""
    if w in ('be',):
        return ['is','am','are','was','were','been','being']
    if w in IRREG_V:
        past, pp = IRREG_V[w]
        return _dedupe([_v3(w), past, pp, _ving(w)])
    return _dedupe([_v3(w), _ved(w), _ved(w), _ving(w)])

def noun_plural(w):
    if w in IRREG_N: return [IRREG_N[w]]
    if w.endswith(('s','x','z','ch','sh')): return [w+'es']
    if w.endswith('y') and len(w)>1 and w[-2] not in 'aeiou': return [w[:-1]+'ies']
    if w.endswith(('f','fe')):
        if w in ('roof','belief','chief','proof','safe'): return [w+'s']
        return [w[:-2]+'ves' if w.endswith('fe') else w[:-1]+'ves']
    if w.endswith('o') and w in ('hero','potato','tomato','echo','negro'): return [w+'es']
    return [w+'s']

def adj_cmp(w):
    if w in IRREG_ADJ:
        c, s = IRREG_ADJ[w]; return [c, s]
    if w in SHORT_ADJ:
        if w.endswith('y'): return [w[:-1]+'ier', w[:-1]+'iest']
        if w.endswith('e'): return [w+'r', w+'st']
        if w in ('big','hot','sad','red','glad','thin','fat','wet','mad'): return [w+w[-1]+'er', w+w[-1]+'est']
        return [w+'er', w+'est']
    return []

def deriv_by_rule(w, pos):
    """按高置信后缀规则补派生；返回 {n/v/adj/adv} 分组的补充项"""
    out = {'n':[], 'v':[], 'adj':[], 'adv':[]}
    low = w
    for p, pat, target, fn in SUFFIX_RULES:
        if pos != p: continue
        if re.search(pat+'$', low):
            cand = fn(low)
            if cand and cand != w and re.match(r'^[a-z]+$', cand):
                out.setdefault(target, []).append(cand)
    return out

def forms_for(w, cn):
    """主入口：根据词条 w 与中文释义 cn 的词性标注生成 forms"""
    forms = {'n': [], 'v': [], 'adj': [], 'adv': [], 'pl': []}
    low = w.lower()
    pos = re.match(r'\s*([a-z]+)\.', cn) or re.match(r'\s*([a-z]+)\s', cn)
    pos = pos.group(1) if pos else ''
    pos_norm = {'a':'adj','ad':'adv','vt':'v','vi':'v','v':'v','n':'n'}.get(pos, pos)
    is_v = pos_norm == 'v'
    is_n = pos_norm == 'n'
    is_adj = pos_norm == 'adj'
    is_adv = pos_norm == 'adv'
    # 动词：变位形态
    if is_v:
        forms['v'] = verb_forms(low)
    # 名词：复数 + 常见派生
    if is_n:
        forms['pl'] = noun_plural(low)
    # 形容词：比较级/最高级 + 副词派生
    if is_adj:
        cmp = adj_cmp(low)
        if cmp:
            forms['adj'] = forms['adj'] + cmp
    # 高置信后缀规则（针对当前词性）
    if is_adj or is_n or is_v or is_adv:
        r = deriv_by_rule(low, pos_norm)
        for k in ('n','v','adj','adv'):
            forms[k] = _dedupe(forms[k] + r[k])
    # 形容词通用 -ly 副词（未被上面规则覆盖且不以 -ly 结尾时）
    if is_adj and not low.endswith('ly') and low not in SUPPRESS_ADV:
        if not forms['adv']:
            forms['adv'] = _dedupe(forms['adv'] + [low + 'ly'])

    # curated 特殊派生
    base = low
    cur = DERIV.get(base) or EXTRA_DERIV.get(base)
    if cur:
        for k in ('n','v','adj','adv'):
            forms[k] = _dedupe(forms[k] + cur.get(k, []))
    # 副词本身：给 -ly 派生（如果它以 -ly 结尾则是普通副词，无进一步派生）
    if is_adv and not low.endswith('ly'):
        forms['adv'] = _dedupe(forms['adv'] + [low+'ly'])
    # 黑名单最后收口（含 DERIV/EXTRA 引入项）
    if low in SUPPRESS_ADV:
        forms['adv'] = []
    for k in ('n','adj'):
        forms[k] = [x for x in forms[k] if x not in SUPPRESS_N]
    return forms

def clean_rel_form(w, rel, cn=''):
    """清洗 rel.form：只保留真·形近异义词（curated 表 + 现有条目中拼写相近的非派生项），
       词态/词族/派生一律移出（进入 forms 或直接删除）。返回清洗后的 rel.form 列表。"""
    low = w.lower()
    forms_all = set()
    f = forms_for(w, cn or '')
    for k in f: forms_all.update(f[k])
    syn = set()
    for s in (rel.get('syn') or []):
        p = _strip_gloss(s).lower()
        if p: syn.add(p)
    conf = (CONFUSABLE.get(low) or []) + (EXTRA_CONFUSABLE.get(low) or [])
    kept = []
    for it in (rel.get('form') or []):
        word = _strip_gloss(it).lower()
        if not word or word == low: continue
        if word in forms_all: continue            # 词态/派生 → 已归 forms
        if word in syn: continue                  # 近义词不是形近词
        if word in conf: kept.append(word)        # curated 形近异义词
    # 补充 curated 表中未在现有 rel.form 里的形近词（同样过滤词态/近义/自身）
    extra = []
    for c in conf:
        if c in kept: continue
        if c == low or c in forms_all or c in syn: continue
        extra.append(c)
    out = _dedupe(kept + extra)
    return out[:4]

def enrich_word(word):
    """供 cron 生成新词条调用：word = {w, cn, ...}; 原地补 forms、清洗 rel.form（若存在）。
       不修改 w/ph/cn/eg/egCn/rel.sound/rel.syn。返回 word。"""
    rel = word.get('rel')
    if rel is None:
        rel = word['rel'] = {}
    if not isinstance(rel, dict): rel = word['rel'] = {}
    word['forms'] = forms_for(word['w'], word.get('cn',''))
    if 'form' in rel:
        rel['form'] = clean_rel_form(word['w'], rel, word.get('cn',''))
    return word

# ---------------------------------------------------------------------------
# CLI：读 data/vocab.js → 输出带 forms/清洗 rel 的 JSONL（每行一个词条）
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    import sys, io, os
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    src = sys.argv[1] if len(sys.argv) > 1 else 'data/vocab.js'
    out = sys.argv[2] if len(sys.argv) > 2 else 'data/_vocab_forms_draft.jsonl'
    s = open(src, encoding='utf-8').read()
    data, _ = json.JSONDecoder().raw_decode(s[s.index('['):])
    n = 0
    with open(out, 'w', encoding='utf-8') as fo:
        for b in data:
            for w in b.get('words', []):
                enrich_word(w)
                rec = {'batch': b['batch'], 'w': w['w'], 'cn': w.get('cn',''),
                       'forms': w.get('forms', {}), 'rel_form': w.get('rel', {}).get('form', [])}
                fo.write(json.dumps(rec, ensure_ascii=False) + '\n')
                n += 1
    print('OK 处理 %d 词 → %s' % (n, out))
