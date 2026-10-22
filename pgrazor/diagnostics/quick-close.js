// Experimental, supported ARM64 build only. No native work on load.

//

// Automatic dismissal of the post-catch summary and matched stats/details.

// Summary follows a confirmed CatchSuccess, by invoking the normal

// inherited GuiController.Dismiss() exactly once on a later proven Unity-thread

// tick. It drives the game's own close path; it never forges success, never

// touches the capture result, never sets currentState, never completes any

// promise, and never calls btqz/btra/HandleDismiss/OnDismissed or any other

// screen callbacks directly. Details use OnDismissOrContinueClicked after buji

// and Initialize return and opening completes. New-species/new-form cutscenes

// and XP/toast presentation remain under the game's normal control flow.

//

// Gating follows build/feature-research/SUMMARY-CLOSE-CONTROLS.txt: the matching

// SummaryState.Initialize(CatchPokemonOutProto), SummaryGui.SetScores and

// SummaryGui.HandleOpenComplete must all have RETURNED for the same GUI instance;

// base currentState (+0x70) must read the normal-open scalar 2 (the value

// DismissWithPromise accepts, per the static disassembly, not guessed from the

// enum); OnDismissed (+0x2a8) must be non-null (installed by the matching state);

// the response must be CatchSuccess with a present captured id; and no

// opener/initialization hook may be on the stack. Queued work is cancelled on

// OFF, lease expiry, stop, user/natural dismissal, identity mismatch or timeout.

//

// Nested native invocation can suppress our own Interceptor callbacks (see

// SUMMARY-CLOSE-NESTED-HOOKS.txt), so the invoke never depends on the Dismiss

// hook firing: it verifies the state transition directly and keeps every owned

// GC handle until released on the Unity thread. Default OFF; a 2500ms lease.

(function(root){

'use strict';


const VGP={camera:'UnityEngine.Camera',screen:'UnityEngine.Screen',wild:'Niantic.Holoholo.Map.WildMapPokemon',pokemon:'Niantic.Holoholo.Map.MapPokemon',stop:'Niantic.Holoholo.Pokestop.MapPokestop',place:'Niantic.Holoholo.Map.IMapPlace',player:'Niantic.Holoholo.PlayerService',playerContract:'Niantic.Holoholo.IPlayerService',bagContract:'Niantic.Holoholo.IPokemonBag',itemContract:'Niantic.Holoholo.IItemBag',rpc:'Niantic.Holoholo.Rpc.RpcHandler',request:'Holoholo.Rpc.FortSearchProto',fort:'Holoholo.Rpc.PokemonFortProto',method:'Holoholo.Rpc.Method',type:'System.Type'};

const LIMITS=Object.freeze({nameBytes:256,assemblies:256,retries:240,leaseMs:2500,pollMs:250,queue:128,timeoutMs:8000,hitsPerSecond:1000,maxRecords:4});

const GUI='Niantic.Holoholo.NUI.GuiController',SGUI='Niantic.Holoholo.Encounter.EncounterSummaryGuiController',SSTATE='Niantic.Holoholo.Encounter.EncounterSummaryState';

const DGUI='Niantic.Holoholo.UI.Pokemon.PokemonInfoGuiController',DATA='Niantic.Holoholo.UI.Pokemon.PokemonInfoData',VIEW='Niantic.Holoholo.Encounter.EncounterViewPokemonState',PK='Holoholo.Rpc.PokemonProto',INT='System.Int32',DELEGATE='System.Delegate',ACTION='System.Action';

const SPINSTATE='Niantic.Holoholo.Pokestop.PokestopSpinnerInteractionState',SPINGUI='Niantic.Holoholo.Pokestop.PokestopSpinnerInteractionGuiController',GESTURE='Niantic.Holoholo.GameInput.ItemSpinnerGestureHandler',SPINNER='Niantic.Holoholo.Map.PoiItemSpinner',SPINBASE='Niantic.Holoholo.Map.BasePoiSpinner',SPINRESULT='Holoholo.Rpc.FortSearchOutProto';

const APPROACH='Niantic.Holoholo.Pokestop.PokestopApproachState',RESOLVE='Niantic.Holoholo.Pokestop.PokestopResolveState',SPLINE='Niantic.Holoholo.CameraRig.SplineCameraController';

const IBAG='Niantic.Holoholo.Internal.ItemBagImpl',ISERVICE='Niantic.Holoholo.UI.Items.ItemInventoryService',IRESPONSE='Holoholo.Rpc.RecycleItemOutProto';

const ITEMCODE={"GetItemCount":[167765300,"fe0f1df8f65701a9f44f02a9748602b0f30300aa888a4839"],"RecycleItem":[167800040,"ffc302d1fd7b05a9fc6f06a9fa6707a9f85f08a9f65709a9"],"get_ExpiringItemsCopy":[163086408,"005c40f9c0035fd6ff8302d1fd7b04a9fc6f05a9fa6706a9"],"cjpx":[163086416,"ff8302d1fd7b04a9fc6f05a9fa6706a9f85f07a9f65708a9"],"ListSortedPlayerInventory":[163101296,"fe0f1bf8fa6701a9f85f02a9f65703a9f44f04a9f4a902d0"],"zid":[167826240,"ff0302d1fe5f05a9f65706a9f44f07a9f58502d0f30301aa"],"zie":[167827064,"fe0f1df8f65701a9f44f02a9f58502d0f30301aaf40300aa"]};

const ROCKET='Niantic.Holoholo.Combat.Contexts.InvasionCombatState',RUI='Niantic.Holoholo.Combat.UI.CombatUI',RDIR='Niantic.Holoholo.Combat.CombatDirectorV2',RCHARGE='Niantic.Holoholo.Combat.UI.CombatChargeAttackDisplay',RSHIELD='Niantic.Holoholo.Combat.InputChallenge.ShieldModalGuiController';

const BERRY='Niantic.Holoholo.Encounter.EncounterInteractionState',BERRYGUI='Niantic.Holoholo.Encounter.EncounterItemUseGuiController',FEEDGUI='Niantic.Holoholo.UI.Items.FeedItemGuiBase';

const BERRY_CODE={"get_CanUseBerry":[181361316,"081842b91f010071e0179f1ac0035fd600b04a39c0035fd6"],"get_IsInPhotoMode":[181361364,"fe57bea9f44f01a9d41e02d0f30300aa88d2593908010037"],"get_PokeballInPlay":[181361500,"fe57bea9f44f01a9d41e02d0f30300aa88065c3908010037"],"SelectBerry":[181379392,"fe0f1bf8fa6701a9f85f02a9f65703a9f44f04a9b41e02b0"],"EnterState":[181381832,"fe0f1cf8f85f01a9f65702a9f44f03a9b41e02b0f30300aa"],"ExitState":[181396348,"fe67bca9f85f01a9f65702a9f44f03a9941e02b0f30300aa"],"ClickConfirm":[162887612,"fe67bca9f85f01a9f65702a9f44f03a994ab02d0f30300aa"]};

const BATTLE_TYPES={"31514":"Niantic.Holoholo.VNext.RaidBattleVNextState","31244":"Niantic.Holoholo.Bread.BreadBattleState","10591":"Niantic.Holoholo.Gym.GymBattleState","31499":"Niantic.Holoholo.VNext.RaidBattleGestureHandler","31285":"Niantic.Holoholo.Bread.BreadBattleGestureHandler","9182":"Niantic.Holoholo.Battle.BattleGestureHandler","9308":"Niantic.Holoholo.Battle.ChargeAttackDisplay","31280":"Niantic.Holoholo.Bread.BreadAbilityWidget","9284":"Niantic.Holoholo.Battle.EnemyAlertIndicator","31623":"Niantic.Holoholo.VNext.EnemyAlertIndicatorVNext","31263":"Niantic.Holoholo.Bread.TelegraphIndicator","31569":"Niantic.Holoholo.VNext.BattleDirector","44226":"Niantic.Holoholo.VNext.BattleState"};

const BATTLE_CODE={"9182:OnEnable":[183456908,"ff8301d1fe1300f9f85f03a9f65704a9f44f05a9d40e02f0"],"9182:OnDisable":[183458624,"fe0f1df8f65701a9f44f02a9d40e02f0f30300aa884e4439"],"9182:SetChargeAttackButtons":[183459176,"682002b0010c0bf808c144b9a8010034fe0f1ff8098052d3"],"9182:bwqr":[183459244,"ff0303d1ea2300fde923056dfd7b06a9fc6f07a9fa6708a9"],"9308:get_IsCharged":[183731356,"00e04639c0035fd601e00639c0035fd600e44639c0035fd6"],"9308:Init":[183731452,"ff8302d1ea1300fde923036dfd7b04a9fc6f05a9fa6706a9"],"9308:ChargeAttackButtonTapped":[183752404,"e80f19fcfd7b01a9fc6f02a9fa6703a9f85f04a9f65705a9"],"10591:EnterState":[156310396,"fd7bbaa9fc6f01a9fa6702a9f85f03a9f65704a9f44f05a9"],"10591:ExitState":[156312036,"fd7bbaa9fc6f01a9fa6702a9f85f03a9f65704a9f44f05a9"],"31244:EnterState":[153265176,"ff0302d1fd7b02a9fc6f03a9fa6704a9f85f05a9f65706a9"],"31244:ExitState":[153275788,"fe57bea9f44f01a9d4f402d0f30300aa88ae6a39a8010037"],"31280:Cleanup":[153336952,"fe0f1cf8f85f01a9f65702a9f44f03a954f402f0f30300aa"],"31280:Refresh":[153342188,"080040f9023941f9033541f960001fd6e10000b4081841b9"],"31285:cqjz":[153354200,"fe4fbfa9f30300aa1e6a009468fa40b908010034080d0051"],"31351:SetChargeAttackButtons":[153460496,"480503b0018c0ef808c144b9a8010034fe0f1ff8098052d3"],"31351:OnEnable":[153460988,"fe0f1cf8f85f01a9f65702a9f44f03a974f30290f30300aa"],"31351:OnDisable":[153462380,"fe0f1df8f65701a9f44f02a974f30290f30300aa88626e39"],"31499:cqjz":[153796784,"fe4fbfa9f30300aae8b9fe97e00313aae1031faafe4fc1a8"],"31514:EnterState":[153812088,"fe0f1bf8fa6701a9f85f02a9f65703a9f44f04a9b6f002f0"],"31514:ExitState":[153828484,"fe57bea9f44f01a994f002f0f30300aa883a7539a8010037"],"31351:cqpd":[153469604,"fe5fbda9f65701a9f44f02a955f302d0f303012af40300aa"],"9182:bwqu":[183462720,"e80f1dfcfe0700f9f65701a9f44f02a9d50e02d0f40301aa"],"31623:crlu":[154115704,"fe57bea9f44f01a974ee02b0f30300aa888a7a3948020037"],"31263:cqim":[153315360,"e80f1efcfe4f01a9034040bd0840201e01e4002f02102e1e"],"9283:MoveNext":[183692812,"ff8301d1e923026dfe1b00f9f65704a9f44f05a9140d02d0"],"31569:get_CurrentState":[153929856,"008840f9c0035fd600604439c0035fd601600439c0035fd6"],"31351:cqpa":[153467264,"fe67bca9f85f01a9f65702a9f44f03a953f302f0f40300aa"],"31351:OnDestroy":[153460632,"fe5fbda9f65701a9f44f02a974f302b0f30300aa885e6e39"]};

const RMINI='Niantic.Holoholo.Combat.InputChallenge.ParticleTapInputChallenge',RMINIBASE='Niantic.Holoholo.Combat.InputChallenge.CombatInputChallenge';

const RMCode={"UpdateMinigame":[179051108,"ffc301d1ea0b00fde923026dfe6703a9f85f04a9f65705a9"],"ExitGame":[179057384,"ff4302d1eb2b026de923036dfe2300f9fa6705a9f85f06a9"],"Hide":[179046660,"fe0f1cf8f85f01a9f65702a9f44f03a9743002d0f30300aa"],"OnDestroy":[179047376,"fe5fbda9f65701a9f44f02a9743002d0f30300aa88c26739"]};

const RVUI='Niantic.Holoholo.Combat.UI.CombatVNextGuiController',RVGEST='Niantic.Holoholo.VNext.CombatVNextGestureHandler',RVBASE='Niantic.Holoholo.VNext.BattleGestureHandlerVNext',RVCHARGE='Niantic.Holoholo.VNext.ChargeAttackDisplayVNext';

const RVCode={"31113:UpdateUiWidgets":[152955364,"e80f1bfcfe0700f9fa6701a9f85f02a9f65703a9f44f04a9"],"31113:HandleDismiss":[152947860,"fe57bea9f44f01a954f702d0f30300aa88e2653908010037"],"31113:get_IsInputBlocked":[152950684,"fe5fbda9f65701a9f44f02a954f702b0f30300aa88ee6539"],"31443:cqul":[153694288,"ff4301d1fe0b00f9f85f02a9f65703a9f44f04a994f102f0"],"31616:ObserveBattleState":[154064256,"fe0f1af8fc6f01a9fa6702a9f85f03a9f65704a9f44f05a9"],"31616:ChargeAttackButtonTapped":[154083804,"e80f1afcfe0700f9fc6f01a9fa6702a9f85f03a9f65704a9"],"31616:get_IsCharged":[154057736,"00b04839c0035fd601b00839c0035fd600b44839c0035fd6"],"31616:get_IsVisible":[154057800,"fe0f1df8f65701a9f44f02a908bc483928080034e1031faa"]};

const ROCKETCODE={"7100:UpdateActionsUI":[179283360, "fe5fbda9f65701a9f44f02a915cc40f9750d00b4962f02d0"],"7137:EnterState":[179334704,"fe0f1cf8f85f01a9f65702a9f44f03a9562e0290f40302aa"],"7137:ExitState":[179351272,"fe0f1df8f65701a9f44f02a9342e0290f30300aa88027139"],"7100:Initialize":[179268616,"ef3bb86ded33016deb2b026de923036dfe6704a9f85f05a9"],"7100:HandleDismiss":[179270220,"fe0f1cf8f85f01a9f65702a9f44f03a9b42e02f0f30300aa"],"7100:bpro":[179262080,"fe57bea9f44f01a9d42e02b0f30300aa886a6d3908010037"],"6533:get_IsInActiveState":[178007452,"fe57bea9f44f01a974380290f30300aa88ee5139e8000036"],"6533:TryFastAttack":[178019108,"fe0f1df8f65701a9f44f02a9543802b0f30300aa88065239"],"7064:OnTap":[179204872,"ff8301d1fe6702a9f85f03a9f65704a9f44f05a9342f02f0"],"7064:get_IsVisible":[179194140,"ff0301d1fe0b00f9f65702a9f44f03a9e1031faaf30300aa"],"6971:ShowShieldPrompt":[179031204,"fe67bca9f85f01a9f65702a9f44f03a9953002d0f303012a"],"6971:ShieldUiClicked":[179036768,"ffc301d1fe1300f9fa6703a9f85f04a9f65705a9f44f06a9"],"6971:HandleDismiss":[179036540,"fe57bea9f44f01a993300290f40300aa689a673908010037"]};

const RELEASE='Holoholo.Rpc.ReleasePokemonOutProto';

const BAG='Niantic.Holoholo.Internal.PokemonBagImpl',DISPLAY='Holoholo.Rpc.PokemonDisplayProto';

const RESP='Holoholo.Rpc.CatchPokemonOutProto',ITEM='Holoholo.Rpc.Item',OBJ='UnityEngine.Object',SYNC='UnityEngine.UnitySynchronizationContext',BOOL='System.Boolean',ENUM=RESP+'.Types.Status';

// Normal-open close state. GuiController.Dismiss no-ops at 0 or 3; DismissWithPromise

// accepts 2 and writes 3 before HandleDismiss (SUMMARY-CLOSE-CONTROLS.txt:62-65).

const STATE_OPEN=2;

// Method identity: debug_get_method_info address must equal module.base+rva, then a

// instruction prefix extracted from the hash-verified clean library in

// summary-close-contract/instruction-prefixes.json. op_Implicit uses the verified

// quick-ball.js fingerprint. ExecuteTasks is resolved by its exact signature.

const CODE={

 detailsPresent:[0xada4ac8,'ff0302d1fd7b02a9fc6f03a9fa6704a9f85f05a9f65706a9f44f07a9571902f0'],

 detailsExit:[0xada5814,'fe0f1ef8f44f01a9086c40f9f30300aaa80000b4090d40f9002140f9011540f9'],

 detailsOpen:[0x9a2a4b0,'fe5fbda9f65701a9f44f02a9f4b402f0f30300aa88f6503928020036f58a02f0'],

 detailsInit:[0x9a2d004,'ff8301d1fe6702a9f85f03a9f65704a9f44f05a9f5b40290f30301aaf40300aa'],

 detailsClick:[0x9a3702c,'fe57bea9f44f01a994b402d0f30300aa88a65139e800003694b402d088d65039'],



 exitState:[0xad3724c,'fe67bca9f85f01a9f65702a9f44f03a9d41c0290f30300aa886e5f3928040037'],

 dismiss:[0xa375344,'fe0f1df8f65701a9f44f02a9b46a02f0f30300aa88ea513968020036b46a02f0'],

 handleOpenComplete:[0xad2c7fc,'fe67bca9f85f01a9f65702a9f44f03a9141d02f0f30300aa8836613908010037'],

 setScores:[0xad2eb84,'ff4305d1ef3b0b6ded330c6deb2b0d6de9230e6dfd7b0fa9fc6f10a9fa6711a9'],

 initialize:[0xad37690,'fe6fbba9fa6701a9f85f02a9f65703a9f44f04a9d51c0290f40301aaf30300aa'],

 op_Implicit:[0xda6bba0,'fe0f1df8f65701a9f44f02a9f4b30090f30300aa882e673988020036f48800d0']};

const GIFT_OPEN_SEQUENCE='Niantic.Holoholo.Social.Gifting.UI.OpenGiftGuiController.ddh';

const GIFT_OPEN_SEQUENCE_CODE=[177597004, "ff0302d1e81300fdfe1700f9fc6f03a9fa6704a9f85f05a9"];

const GIFT_TYPES={"5916": "Niantic.Holoholo.Social.UI.FriendProfileGuiController", "5936": "Niantic.Holoholo.Social.UI.FriendProfileInfoPanel", "6240": "Niantic.Holoholo.Social.Gifting.UI.OpenGiftGuiController", "6258": "Niantic.Holoholo.Social.Gifting.UI.SendGiftGuiController", "6268": "Niantic.Holoholo.Social.Gifting.UI.ViewGiftsGuiController", "6211": "Niantic.Holoholo.Social.Gifting.UI.GiftItemView2Widget", "6176": "Niantic.Holoholo.Social.Gifting.UI.StickerSelectionItemWidget", "6195": "Niantic.Holoholo.Social.Gifting.UI.StickerSheetGuiController", "6164": "Niantic.Holoholo.Social.Gifting.StickerService"};

const GIFT_CODE={"5916.get_ActionButtonsDisabled": [176789820, "00c04639c0035fd601c00639c0035fd6fe57bea9f44f01a9"], "5916.get_CurrentlyOpenFriendProfileInfoPanel": [176789836, "fe57bea9f44f01a9b4410290f30300aa88f6783908010037"], "5916.HandleOpenComplete": [176791260, "fe5fbda9f65701a9f44f02a9b4410290f30300aa88067939"], "5916.HandleDismiss": [176794104, "fd7bbaa9fc6f01a9fa6702a9f85f03a9f65704a9f44f05a9"], "5936.SetFriendInfo": [176826240, "fe0f1bf8fa6701a9f85f02a9f65703a9f44f04a9554102f0"], "5936.CheckOnGift": [176809692, "ff0302d1fe6704a9f85f05a9f65706a9f44f07a9744102f0"], "5936.OnGiftClick": [176871800, "fe5fbda9f65701a9f44f02a914410290f30300aa88c67939"], "6164.AnyStickers": [177422984, "fe57bea9f44f01a9d43c02d0f30300aa887a4439e8020037"], "6164.StickerCountExcludingReserved": [177433316, "fe0f1df8f65701a9f44f02a9d53c0290f40301aaf30300aa"], "6240.HandleOpenComplete": [177580256, "c0035fd6fe57bea9f44f01a9b43b0290f30300aa88ca4739"], "6240.HandleDismiss": [177580260, "fe57bea9f44f01a9b43b0290f30300aa88ca473908010037"], "6240.OnOpenClick": [177580924, "08a44a394800003402000014cc000014ff4302d1fe6705a9"], "6258.HandleOpenComplete": [177634752, "e80f1dfcfe0700f9f65701a9f44f02a9343b02f0f30300aa"], "6258.HandleDismiss": [177635080, "1fd40b39c0035fd6fe57bea9f44f01a9343b02f0f30300aa"], "6258.OnSendClick": [177635852, "fe0f1df8f65701a9f44f02a9343b02d0f30300aa887e4839"], "6258.OnStickersClick": [177641572, "fe0f1cf8f85f01a9f65702a9f44f03a9343b02b0f30300aa"], "6176.Click": [177447172, "fe57bea9f44f01a9b33c0290f40300aa681a453908010037"], "6176.Reinitialize": [177447400, "e80f1cfcfe0700f9f85f01a9f65702a9f44f03a9b43c0290"], "6195.HandleOpenComplete": [177462784, "fe0f1cf8f85f01a9f65702a9f44f03a9943c02b0f30300aa"], "6195.HandleDismiss": [177463472, "fe0f1df8f65701a9f44f02a9943c0290f30300aa885a4539"], "6211.UpdateData": [177537608, "fe5fbda9f65701a9f44f02a9f63b02d0f30302aaf503012a"], "6211.GiftBox": [177538336, "3f04007128010054086840f9e80000b43f00007109038052"], "6211.OnClick": [177538548, "097040f9090100b4e80300aa202140f9231540f9240d40f9"], "6268.Initialize": [177657828, "fe6fbba9fa6701a9f85f02a9f65703a9f44f04a9153b02b0"], "6268.HandleOpenComplete": [177663572, "c0035fd6fe57bea9f44f01a9143b0290f30300aa88d24839"], "6268.HandleDismiss": [177663576, "fe57bea9f44f01a9143b0290f30300aa88d2483908010037"]};

Object.assign(GIFT_CODE,{"6268.ExitGui": [177664272, "fe0f1df8f65701a9f44f02a9f43a02f0f30300aa88da4839"], "6258.bnah": [177646492, "fe0f1bf8fa6701a9f85f02a9f65703a9f44f04a9353b0290"]});

Object.assign(GIFT_CODE,{"6164.GetStickerInventory": [177426172, "fe5fbda9f65701a9f44f02a9d53c02d0f303012af40300aa"], "6258.bmzx": [177632528, "fe0f1af8fc6f01a9fa6702a9f85f03a9f65704a9f44f05a9"]});

Object.assign(GIFT_TYPES,{6149:'Niantic.Holoholo.Social.Gifting.GiftingRpcService',6154:'Niantic.Holoholo.Social.Gifting.GiftingService'});

Object.assign(GIFT_CODE,{"6149.SendGift": [177377404, "fe0f1af8fc6f01a9fa6702a9f85f03a9f65704a9f44f05a9"], "6154.get_SendableGiftsInInventory": [177385668, "fe0f1df8f65701a9f44f02a9143d02f0f30300aa883a4639"], "6164.ReserveStickers": [177430692, "ff4302d1fe6705a9f85f06a9f65707a9f44f08a9d53c0290"], "6164.ReturnReservedStickers": [177431808, "ff0302d1fe2300f9f85f05a9f65706a9f44f07a9d63c0290"], "6147.bmnz": [177383752, "fe0f1cf8f85f01a9f65702a9f44f03a9343d0290f60301aa"], "6147.bmoa": [177384848, "fe57bea9f44f01a9343d0290f30300aa88e2433908010037"]});

const BUDDY_TYPES={"7757": "Niantic.Holoholo.Buddy.BuddyObservedDataExt", "7768": "Niantic.Holoholo.Buddy.BuddyRpcService", "7769": "Niantic.Holoholo.Buddy.BuddyStatsService", "8109": "Niantic.Holoholo.Buddy.BuddyPokemonService"};

const BUDDY_CODE={"7757.OnMapRemainingSec": [180184056, "fe57bea9f44f01a9d42702b0f30300aa8806413908010037"], "7757.PreMapFullnessPercentage": [180184200, "00e4002f800000b4082040f9480000b4001940bdc0035fd6"], "7757.InFullnessCooldown": [180184224, "fe57bea9f44f01a9d42702b0f30300aa880a413908010037"], "7768.Feed": [180188396, "fe0f1cf8f85f01a9f65702a9f44f03a9d5270290f303022a"], "8109.get_BuddyPokemon": [180846228, "00b840f9c0035fd6483402f001b800f908c144b9c8010034"], "8109.get_HasBuddy": [180846316, "00e04539c0035fd601e00539c0035fd6fe57bea9f44f01a9"], "7763.brhd": [180191752, "fe0f1df8f65701a9f44f02a9b52702f0f30301aaf40300aa"], "7769.get_BuddyStats": [180193380, "003840f9c0035fd6483902d0010c07f808c144b9a8010034"]};

const BERRY_THROW_CODE={"btdx": [181423396, "fe67bca9f85f01a9f65702a9f44f03a9551e02f0f403012a"], "btdy": [181424920, "e80f1cfcfe0700f9f85f01a9f65702a9f44f03a9551e02d0"], "btdz": [181425904, "fe57bea9f44f01a9080840f9280500b4141e02f013fd40f9"], "get_HoldingBreadBall": [181757284, "00004939c0035fd601000939c0035fd6ff0301d1e80b00fd"], "get_BallType": [181765900, "007443b9c0035fd6017403b9c0035fd6e1031faaae05b414"], "submit": [181795804, "fe5fbda9f65701a9f44f02a9961b0290f50302aaf40301aa"], "peek": [181764464, "fe0f1df8f65701a9f44f02a9b41b02f0f30300aa88866239"]};

const SPEC={field_set_value_object:['void',['pointer','pointer','pointer']],object_new:['pointer',['pointer']],field_set_value:['void',['pointer','pointer','pointer']],object_get_virtual_method:['pointer',['pointer','pointer']],class_get_methods:['pointer',['pointer','pointer']],string_length:['int',['pointer']],string_chars:['pointer',['pointer']],class_get_nested_types:['pointer',['pointer','pointer']],class_get_declaring_type:['pointer',['pointer']],domain_get:['pointer',[]],domain_get_assemblies:['pointer',['pointer','pointer']],assembly_get_image:['pointer',['pointer']],class_from_name:['pointer',['pointer','pointer','pointer']],class_get_type:['pointer',['pointer']],class_get_field_from_name:['pointer',['pointer','pointer']],field_get_type:['pointer',['pointer']],field_get_flags:['int',['pointer']],field_get_parent:['pointer',['pointer']],field_get_offset:['size_t',['pointer']],class_get_method_from_name:['pointer',['pointer','pointer','int']],method_get_class:['pointer',['pointer']],method_get_name:['pointer',['pointer']],method_get_flags:['uint32',['pointer','pointer']],method_get_param_count:['uint32',['pointer']],method_get_param:['pointer',['pointer','uint32']],method_get_return_type:['pointer',['pointer']],method_is_generic:['bool',['pointer']],method_is_inflated:['bool',['pointer']],class_from_type:['pointer',['pointer']],class_is_enum:['bool',['pointer']],class_enum_basetype:['pointer',['pointer']],class_is_valuetype:['bool',['pointer']],class_value_size:['int',['pointer','pointer']],field_static_get_value:['void',['pointer','pointer']],type_get_name:['pointer',['pointer']],free:['void',['pointer']],thread_current:['pointer',[]],thread_attach:['pointer',['pointer']],thread_detach:['void',['pointer']],object_get_class:['pointer',['pointer']],field_get_value:['void',['pointer','pointer','pointer']],runtime_invoke:['pointer',['pointer','pointer','pointer','pointer']],object_unbox:['pointer',['pointer']],gchandle_new:['pointer',['pointer','bool']],gchandle_get_target:['pointer',['pointer']],gchandle_free:['void',['pointer']]};

// Unity-thread identity/tick: match il2cpp_runtime_invoke whose first argument is the

// resolved UnitySynchronizationContext.ExecuteTasks method. Dismiss()/op_Implicit are

// invoked on that thread; a non-ExecuteTasks invoke is never treated as a tick.

const FILTER=`

#include <gum/guminterceptor.h>

#include <glib.h>

extern gpointer execute_method;

extern int enter_match(unsigned int tid);

extern void leave_match(unsigned int tid);

typedef struct {int accepted;} Match;

void on_enter(GumInvocationContext *ic){Match *m=GUM_IC_GET_INVOCATION_DATA(ic,Match);m->accepted=0;if(gum_invocation_context_get_nth_argument(ic,0)==execute_method)m->accepted=enter_match(gum_invocation_context_get_thread_id(ic));}

void on_leave(GumInvocationContext *ic){Match *m=GUM_IC_GET_INVOCATION_DATA(ic,Match);if(m->accepted)leave_match(gum_invocation_context_get_thread_id(ic));}

`;

const DEBUG=[0x90051008,0xf9474508,0xb4000148,0x90051009,0xf9474929,0xb40000e9,0xf940040a,0xeb0a011f,0x2a1f03e8,0x54000128,0xeb0a013f,0x540000e3,0xb40000a1,0xf9400408,0xb900083f,0xf900083f,0xf9000028,0x52800028,0x2a0803e0,0xd65f03c0];

let running=null;

// Keep native filter storage alive through any invocation already in flight.

const SPAWN='Niantic.Holoholo.Map.MapEntityService';

const retainedFilters=[];

function text(p){if(p.isNull())throw Error('null-name');let n=0;while(n<LIMITS.nameBytes&&p.add(n).readU8())n++;if(n===LIMITS.nameBytes)throw Error('name-limit');return n?p.readUtf8String(n):'';}

function bind(module){const api={};for(const[key,[result,args]]of Object.entries(SPEC)){const address=module.findExportByName('il2cpp_'+key);if(!address||address.isNull())throw Error('missing-export:'+key);// Managed calls must retain the game's native exception handling. Stealing a fault
// unwinds IL2CPP/ART frames and can produce a later JNI trampoline crash.
api[key]=new NativeFunction(address,result,args,key==='runtime_invoke'?{scheduling:'exclusive',exceptions:'propagate'}:{scheduling:'exclusive'});}return api;}

function typeName(api,type){const value=api.type_get_name(type);if(value.isNull())throw Error('null-type-name');try{return text(value);}finally{api.free(value);}}

function clock(){const libc=Process.findModuleByName('libc.so');const address=libc&&libc.findExportByName('clock_gettime');if(!address||address.isNull())throw Error('missing-monotonic-clock');const call=new NativeFunction(address,'int',['int','pointer'],{scheduling:'exclusive'});const out=Memory.alloc(16);let previous=-1;return()=>{if(call(7,out)!==0)throw Error('monotonic-clock-failed');const sec=out.readS64().toNumber(),ns=out.add(8).readS64().toNumber(),now=sec*1000+ns/1e6;if(!Number.isSafeInteger(sec)||sec<0||ns<0||ns>=1e9||!Number.isFinite(now)||now<previous)throw Error('invalid-monotonic-clock');previous=now;return now;};}

function checkBytes(address,hex){const bytes=new Uint8Array(address.readByteArray(hex.length/2));if(bytes.length!==hex.length/2)throw Error('short-instruction-read');for(let i=0;i<bytes.length;i++)if(bytes[i]!==parseInt(hex.slice(i*2,i*2+2),16))throw Error('unsupported-instructions');}

function executable(module,address,size){if(address.isNull()||!address.and(3).isNull()||address.compare(module.base)<0||address.add(size).compare(module.base.add(module.size))>0)throw Error('invalid-code-range');const range=Process.findRangeByAddress(address);if(!range||range.protection.indexOf('r')<0||range.protection.indexOf('x')<0||address.add(size).compare(range.base.add(range.size))>0)throw Error('code-not-rx');}

function pointerHandleAbi(module){

 // Narrow fingerprint of the shipped 6000.3.22f1 ARM64 GC handle implementation,

 // identical to quick-ball.js. No GC handle function is called until it verifies.

 function readableCode(address,length){if(address.compare(module.base)<0||address.add(length).compare(module.base.add(module.size))>0)return false;const range=Process.findRangeByAddress(address);return range!==null&&range.protection.includes('r')&&range.protection.includes('x')&&address.add(length).compare(range.base.add(range.size))<=0;}

 function words(address,expected){return readableCode(address,expected.length*4)&&expected.every((word,i)=>address.add(i*4).readU32()===word);}

 function branch(address){if(!readableCode(address,4))return null;const word=address.readU32();if((word>>>26)!==5)return null;let immediate=word&0x03ffffff;if(immediate&0x02000000)immediate-=0x04000000;const target=address.add(immediate*4);return readableCode(target,4)?target:null;}

 try{

  const create=module.findExportByName('il2cpp_gchandle_new'),get=module.findExportByName('il2cpp_gchandle_get_target'),free=module.findExportByName('il2cpp_gchandle_free');

  if(!create||!get||!free||create.isNull()||get.isNull()||free.isNull())return false;

  if(!words(create,[0xaa0003e8,0x52800049,0x7200003f,0x1a890520,0xaa0803e1]))return false;

  const createBody=branch(create.add(20)),getBody=branch(get),freeBody=branch(free);

  return createBody!==null&&getBody!==null&&freeBody!==null&&words(createBody.add(0x384),[0x9a953120])&&words(getBody,[0xf81b0ffe])&&words(getBody.add(20),[0x9273c817,0x394082e8])&&words(freeBody,[0xf81b0ffe])&&words(freeBody.add(24),[0x9273c816,0x394082c8]);

 }catch(_){return false;}

}

function prepare(module,api,domain){

 let owned=null;

 try{

  if(api.thread_current().isNull()){owned=api.thread_attach(domain);if(owned.isNull())throw Error('metadata-thread-attach');}

  const count=Memory.alloc(8);count.writeU64(0);const list=api.domain_get_assemblies(domain,count),total=count.readU64();

  if(total.compare(0)===0)return null;if(total.compare(LIMITS.assemblies)>0||list.isNull())throw Error('assembly-limit');

  const required=[GUI,SGUI,SSTATE,RESP,OBJ,SYNC,BOOL],names=required.concat(Object.values(VGP),['System.Collections.IEnumerable','Niantic.Holoholo.Items.IncubatorService','Niantic.Holoholo.Items.IIncubatorService','Holoholo.Rpc.EggIncubatorProto','Niantic.Holoholo.Gym.MapGym','Holoholo.Rpc.RaidInfoProto','Holoholo.Rpc.GymDisplayProto','Holoholo.Rpc.PokemonProto','Holoholo.Rpc.CharacterSize','System.Collections.IEnumerator','System.IDisposable','Holoholo.Rpc.GiftBoxProto',GIFT_OPEN_SEQUENCE,'Holoholo.Rpc.OpenGiftOutProto','Holoholo.Rpc.SendGiftOutProto'],Object.values(BUDDY_TYPES),['Niantic.Holoholo.Buddy.IBuddyStatsService','Holoholo.Rpc.BuddyObservedData','Holoholo.Rpc.BuddyFeedingOutProto','Holoholo.Rpc.BuddyPokemonProto'],Object.values(GIFT_TYPES),['Niantic.Platform.Internal.Protos.FriendDetailsProto','Niantic.Platform.Internal.Protos.PlayerSummaryProto','Holoholo.Rpc.GiftBoxDetailsProto','Holoholo.Rpc.StickerProto'],['Niantic.Holoholo.Encounter.Pokeball','Niantic.Holoholo.Encounter.PokeballThrow',SPAWN,BERRY,BERRYGUI,FEEDGUI],Object.values(BATTLE_TYPES),['UnityEngine.Behaviour','UnityEngine.UI.Button',RMINI,RMINIBASE,'UnityEngine.Component','UnityEngine.Transform','UnityEngine.GameObject','UnityEngine.Vector3',RVUI,RVGEST,RVBASE,RVCHARGE,ROCKET,RUI,RDIR,RCHARGE,RSHIELD,'UnityEngine.UI.Selectable','Niantic.Holoholo.UI.Items.ItemInventoryGuiService','Niantic.Holoholo.UI.Items.IItemInventoryGuiService','Niantic.Holoholo.MapSceneContext','Zenject.SceneContext','Zenject.DiContainer','Niantic.Holoholo.UI.Items.IItemInventoryService',IBAG,ISERVICE,IRESPONSE,ITEM,APPROACH,RESOLVE,SPLINE,SPINSTATE,SPINGUI,GESTURE,SPINNER,SPINBASE,SPINRESULT,RELEASE,BAG,DISPLAY,DGUI,DATA,VIEW,PK,INT,'Holoholo.Rpc.GymGetInfoProto','Holoholo.Rpc.GymGetInfoOutProto','Holoholo.Rpc.GymStatusAndDefendersProto','Holoholo.Rpc.GymDefenderProto','Holoholo.Rpc.MotivatedPokemonProto','Niantic.Holoholo.Quests.IQuestService','Niantic.Holoholo.Quests.QuestService','Niantic.Holoholo.Quests.IQuestRpcService','Niantic.Holoholo.Quests.QuestRpcService','Niantic.Holoholo.Quests.QuestProtoExt','Holoholo.Rpc.QuestProto','Holoholo.Rpc.QuestDisplayProto','Holoholo.Rpc.QuestRewardProto','Holoholo.Rpc.ItemRewardProto','Holoholo.Rpc.PokemonCandyRewardProto','Holoholo.Rpc.PokemonEncounterRewardProto',DELEGATE,ACTION]),classes={};

  const inputs=names.map(n=>{const i=n.lastIndexOf('.');return[n,Memory.allocUtf8String(n.slice(0,i)),Memory.allocUtf8String(n.slice(i+1))];});

  for(let i=0;i<total.toNumber();i++){const image=api.assembly_get_image(list.add(i*8).readPointer());if(image.isNull())continue;

   for(const[name,ns,short]of inputs){const k=api.class_from_name(image,ns,short);if(k.isNull())continue;

    if(typeName(api,api.class_get_type(k))!==name||(classes[name]&&!classes[name].equals(k)))throw Error('class-mismatch:'+name);classes[name]=k;}}

  if(required.some(n=>!classes[n]))return null;

  const align=Memory.alloc(4),fieldMeta=[];

  function raw(owner,name,offset){const f=api.class_get_field_from_name(owner,Memory.allocUtf8String(name));

   if(f.isNull()||!api.field_get_parent(f).equals(owner)||(api.field_get_flags(f)&0x50)||Number(api.field_get_offset(f).toString())!==offset)throw Error('field-mismatch:'+name);return f;}

  // Reference fields (type encoding is not decoded in the contract, so the type

  // name is never asserted): confirm owner, offset, non-static and that the field

  // is a reference, not a value type. Runtime checks the actual object class.

  function refField(owner,name,offset){const f=raw(owner,name,offset);const klass=api.class_from_type(api.field_get_type(f));if(klass.isNull()||api.class_is_valuetype(klass))throw Error('field-not-reference:'+name);fieldMeta.push({name,owner:typeName(api,api.class_get_type(owner)),offset,kind:'ref'});return f;}

  // Int32-enum field (currentState): no fully-qualified enum name is invented; the

  // Int32 basetype, 4-byte size/alignment and value-type kind are verified instead.

  function enumI32Field(owner,name,offset){const f=raw(owner,name,offset);const klass=api.class_from_type(api.field_get_type(f));

   if(klass.isNull()||!api.class_is_enum(klass)||typeName(api,api.class_enum_basetype(klass))!=='System.Int32'||api.class_value_size(klass,align)!==4||align.readU32()!==4)throw Error('enum-abi:'+name);fieldMeta.push({name,owner:typeName(api,api.class_get_type(owner)),offset,kind:'enum-int32'});return f;}

  // Value-type field (captured id): size is read from metadata, never assumed; the

  // raw bytes are only checked for presence (non-zero), their meaning is not decoded.

  function valueField(owner,name,offset){const f=raw(owner,name,offset);const klass=api.class_from_type(api.field_get_type(f));if(klass.isNull()||!api.class_is_valuetype(klass))throw Error('field-not-value:'+name);const size=api.class_value_size(klass,align);if(size!==4&&size!==8)throw Error('value-size:'+name);fieldMeta.push({name,owner:typeName(api,api.class_get_type(owner)),offset,kind:'value',size});return{field:f,size};}

  const caughtId=valueField(classes[RESP],'CapturedPokemonId',0x20);

  if(caughtId.size!==8||typeName(api,api.field_get_type(caughtId.field))!=='System.UInt64')throw Error('captured-id-abi');

  const fields={currentState:enumI32Field(classes[GUI],'currentState',0x70),onDismissed:refField(classes[SGUI],'OnDismissed',0x2a8),

   dscx:refField(classes[SSTATE],'dscx',0xc0),dscy:refField(classes[SSTATE],'dscy',0xc8),caughtId:caughtId.field,status:enumI32Field(classes[RESP],'Status',0x10)};

  // Confirmed-success literal: CatchSuccess, read like quick-ball.js/quick-summary.js.

  const enumClass=api.class_from_type(api.field_get_type(fields.status)),literal=api.class_get_field_from_name(enumClass,Memory.allocUtf8String('CatchSuccess'));

  if(literal.isNull()||!api.field_get_parent(literal).equals(enumClass)||(api.field_get_flags(literal)&0x8050)!==0x8050||typeName(api,api.field_get_type(literal))!==ENUM)throw Error('success-literal');

  const out=Memory.alloc(4);api.field_static_get_value(literal,out);const success=out.readS32();

  if(!api.class_is_valuetype(classes[BOOL])||api.class_value_size(classes[BOOL],align)!==1||align.readU32()!==1)throw Error('boxed-abi:'+BOOL);

  if(!pointerHandleAbi(module))throw Error('gc-pointer-abi');

  const debugAddress=module.findExportByName('il2cpp_debug_get_method_info');if(!debugAddress)throw Error('debug-missing');executable(module,debugAddress,80);

  for(let i=0;i<DEBUG.length;i++)if(debugAddress.add(i*4).readU32()!==DEBUG[i])throw Error('debug-abi');

  const debug=new NativeFunction(debugAddress,'bool',['pointer','pointer'],{scheduling:'exclusive'}),addresses=new Set();

  function method(owner,name,ret,params,isStatic,code,inflated=false){const m=api.class_get_method_from_name(owner,Memory.allocUtf8String(name),params.length),impl=Memory.alloc(4);

   if(m.isNull()||!api.method_get_class(m).equals(owner)||text(api.method_get_name(m))!==name||Boolean(api.method_get_flags(m,impl)&16)!==isStatic||api.method_get_param_count(m)!==params.length||api.method_is_generic(m)||(!inflated&&api.method_is_inflated(m))||(typeof ret==='function'?!ret(typeName(api,api.method_get_return_type(m))):typeName(api,api.method_get_return_type(m))!==ret))throw Error('method-mismatch:'+name);

   for(let i=0;i<params.length;i++)if(typeof params[i]==='function'?!params[i](typeName(api,api.method_get_param(m,i))):typeName(api,api.method_get_param(m,i))!==params[i])throw Error('parameter-mismatch:'+name);

   let address=null;if(code){const info=Memory.alloc(24);info.writeByteArray(new Uint8Array(24));if(!debug(m,info))throw Error('debug-failed:'+name);address=info.readPointer();

    if(!address.equals(module.base.add(code[0]))||addresses.has(address.toString()))throw Error('method-address:'+name);addresses.add(address.toString());executable(module,address,code[1].length/2);checkBytes(address,code[1]);}

   return{method:m,address};}

  function enumMap(klass){
   if(klass.isNull()||!api.class_is_enum(klass)||typeName(api,api.class_enum_basetype(klass))!=='System.Int32')throw Error('enum-class');
   const nextField=new NativeFunction(module.findExportByName('il2cpp_class_get_fields'),'pointer',['pointer','pointer'],{scheduling:'exclusive',exceptions:'propagate'});
   const fieldName=new NativeFunction(module.findExportByName('il2cpp_field_get_name'),'pointer',['pointer'],{scheduling:'exclusive',exceptions:'propagate'});
   const map={},it=Memory.alloc(8),v=Memory.alloc(4);it.writePointer(ptr(0));
   for(let i=0;i<4096;i++){const f=nextField(klass,it);if(f.isNull())break;if((api.field_get_flags(f)&0x8050)!==0x8050)continue;api.field_static_get_value(f,v);map[v.readS32()]=text(fieldName(f));}
   return map;
  }
  function enumValue(klass,name){
   if(klass.isNull()||!api.class_is_enum(klass)||typeName(api,api.class_enum_basetype(klass))!=='System.Int32')throw Error('enum-class');
   const f=api.class_get_field_from_name(klass,Memory.allocUtf8String(name));
   if(f.isNull()||!api.field_get_parent(f).equals(klass)||(api.field_get_flags(f)&0x8050)!==0x8050)throw Error('enum-value:'+name);
   const v=Memory.alloc(4);api.field_static_get_value(f,v);return v.readS32();
  }

  const methods={

   exitState:method(classes[SSTATE],'ExitState','System.Void',[],false,CODE.exitState),

   dismiss:method(classes[GUI],'Dismiss','System.Void',[],false,CODE.dismiss),

   initialize:method(classes[SSTATE],'Initialize','System.Void',[RESP],false,CODE.initialize),

   setScores:method(classes[SGUI],'SetScores','System.Void',[RESP,ITEM],false,CODE.setScores),

   handleOpenComplete:method(classes[SGUI],'HandleOpenComplete','System.Void',[],false,CODE.handleOpenComplete),

   alive:method(classes[OBJ],'op_Implicit','System.Boolean',[OBJ],true,CODE.op_Implicit),

   execute:method(classes[SYNC],'ExecuteTasks','System.Void',[],true,null)};

  let details=null,detailsError=null;

  try{

   if([DGUI,DATA,VIEW,PK,INT,DELEGATE,ACTION].some(n=>!classes[n]))throw Error('details-classes-unavailable');

   function scalar(owner,name,offset,type,size){const f=raw(owner,name,offset),k=api.class_from_type(api.field_get_type(f));

    if(typeName(api,api.field_get_type(f))!==type||!api.class_is_valuetype(k)||api.class_value_size(k,align)!==size)throw Error('details-field:'+name);return f;}

   const df={delegateTarget:refField(classes[DELEGATE],'m_target',0x20),viewResponse:refField(classes[VIEW],'dsvw',0xe0),data:refField(classes[DGUI],'egbx',0x3a0),callback:refField(classes[DGUI],'egbu',0x388),

    onDismissed:refField(classes[DATA],'OnScreenDismissed',0x28),list:refField(classes[DATA],'PokemonList',0x10),

    index:scalar(classes[DATA],'StartingIndex',0x18,INT,4),post:scalar(classes[DATA],'IsPostEncounter',0x39,BOOL,1),id:scalar(classes[PK],'id_',0x20,'System.UInt64',8)};

   const listClass=api.class_from_type(api.field_get_type(df.list));

   const dm={

    present:method(classes[VIEW],'buji','System.Void',[PK,n=>/^System\.Collections\.Generic\.List(?:`1)?<Niantic\.Holoholo\.UI\.AwardBubbleData>$/.test(n),BOOL],false,CODE.detailsPresent),

    exit:method(classes[VIEW],'ExitState','System.Void',[],false,CODE.detailsExit),

    initialize:method(classes[DGUI],'Initialize','System.Void',[DATA],false,CODE.detailsInit),

    open:method(classes[DGUI],'HandleOpenComplete','System.Void',[],false,CODE.detailsOpen),

    click:method(classes[DGUI],'OnDismissOrContinueClicked','System.Void',[],false,CODE.detailsClick),

    count:method(listClass,'get_Count',INT,[],false,null,true),item:method(listClass,'get_Item',PK,[INT],false,null,true)};

   details={fields:df,methods:dm,listClass};

  }catch(e){detailsError=String(e);}

  let transfer=null,transferError=null;

  try {

   if(!details||!classes[BAG]||!classes[DISPLAY]||!classes[RELEASE])throw Error('transfer-classes-unavailable');

   function typed(owner,name,offset,type){const f=raw(owner,name,offset);if(typeName(api,api.field_get_type(f))!==type)throw Error('transfer-field:'+name);return f;}

   function enumDefault(f,name){const k=api.class_from_type(api.field_get_type(f)),v=api.class_get_field_from_name(k,Memory.allocUtf8String(name));if(v.isNull()||!api.field_get_parent(v).equals(k)||(api.field_get_flags(v)&0x8050)!==0x8050)throw Error('transfer-enum:'+name);const out=Memory.alloc(4);api.field_static_get_value(v,out);return out.readS32();}

   const tf={resultStatus:enumI32Field(classes[RELEASE],'Status',0x10),bag:typed(classes[VIEW],'dsvj',0x70,'Niantic.Holoholo.IPokemonBag'),gm:typed(classes[VIEW],'dsvo',0x98,'IGameMasterData'),

    attack:typed(classes[PK],'individualAttack_',0x70,INT),defense:typed(classes[PK],'individualDefense_',0x74,INT),stamina:typed(classes[PK],'individualStamina_',0x78,INT),

    favorite:typed(classes[PK],'favorite_',0xb0,BOOL),egg:typed(classes[PK],'isEgg_',0x50,BOOL),display:typed(classes[PK],'pokemonDisplay_',0xd8,DISPLAY),events:refField(classes[PK],'originEvents_',0x188),

    limited:typed(classes[PK],'limitedPokemonIdentifier_',0x130,'System.String'),costume:enumI32Field(classes[DISPLAY],'Costume',0x10),originalCostume:enumI32Field(classes[DISPLAY],'OriginalCostume',0x40),

    background:refField(classes[DISPLAY],'LocationCard',0x58),art:enumI32Field(classes[DISPLAY],'NaturalArtType',0x70),artAsset:enumI32Field(classes[DISPLAY],'NaturalArtBackgroundAsset',0x74)};

   const eventClass=api.class_from_type(api.field_get_type(tf.events));

   const nestedIter=Memory.alloc(8);nestedIter.writePointer(ptr(0));let callbackClass=null;

   for(let i=0;i<256;i++){const k=api.class_get_nested_types(classes[BAG],nestedIter);if(k.isNull())break;

    if(/[.+/]ya$/.test(typeName(api,api.class_get_type(k)))&&api.class_get_declaring_type(k).equals(classes[BAG])){callbackClass=k;break;}}

   if(!callbackClass)throw Error('transfer-callback-class');

   tf.callbackPokemon=typed(callbackClass,'pokemon',0x20,PK);tf.callbackBag=typed(callbackClass,'<>4__this',0x10,BAG);

   const sizeEnum=name=>{const k=classes['Holoholo.Rpc.CharacterSize'],f=api.class_get_field_from_name(k,Memory.allocUtf8String(name)),v=Memory.alloc(4);if(f.isNull()||(api.field_get_flags(f)&0x8050)!==0x8050)throw Error('transfer-size-enum');api.field_static_get_value(f,v);return v.readS32();};
   transfer={sizes:['Xxs','Xs','M','Xl','Xxl'].map(sizeEnum),xxs:sizeEnum('Xxs'),xxl:sizeEnum('Xxl'),fields:tf,eventClass,callbackClass,resultSuccess:enumDefault(tf.resultStatus,'Success'),costumeNone:enumDefault(tf.costume,'Unset'),artNone:enumDefault(tf.art,'NaturalArtUnset'),assetNone:enumDefault(tf.artAsset,'NaturalBackgroundUnset'),methods:{

    result:method(callbackClass,'zlc','System.Void',[RELEASE],false,[0xa0534a0,'ff0302d1fe5f05a9f65706a9f44f07a9d5830290f30301aa']),

    error:method(callbackClass,'zld','System.Void',['System.String'],false,[0xa0538b4,'fe0f1df8f65701a9f44f02a9d5830290f30301aaf40300aa']),

    size:method(classes[PK],'PokemonCharacterSize','Holoholo.Rpc.CharacterSize',['IGameMasterData'],false,null),
    rare:method(classes[PK],'IsLegendaryOrMythicOrUltraBeast',BOOL,['IGameMasterData'],false,null),shiny:method(classes[PK],'get_IsShinyPokemon',BOOL,[],false,null),

    eventCount:method(eventClass,'get_Count',INT,[],false,null,true),

    get:method(classes[BAG],'GetPokemon',PK,['System.UInt64'],false,null),

    release:method(classes[BAG],'ReleasePokemon',n=>/^Niantic\.Promises\.IPromise(?:`1)?<Holoholo\.Rpc\.ReleasePokemonOutProto>$/.test(n),[PK],false,[0xa04d064,'ff4302d1fe2300f9fa6705a9f85f06a9f65707a9f44f08a9f38302d0f50301aa'])}};

  }catch(e){transferError=String(e);}

  let spin=null,spinError=null;

  try{

   if([SPINSTATE,SPINGUI,GESTURE,SPINNER,SPINBASE,SPINRESULT].some(n=>!classes[n]))throw Error('spin-classes-unavailable');

   function spinField(owner,name,offset,type){const f=raw(classes[owner],name,offset);if(typeName(api,api.field_get_type(f))!==type)throw Error('spin-field:'+name);return f;}

   const sf={gui:spinField(SPINSTATE,'deyd',0x128,'Niantic.Holoholo.Pokestop.IPokestopSpinnerInteractionGuiController'),gesture:spinField(SPINSTATE,'deyc',0x120,GESTURE),spinner:spinField(GESTURE,'dkbf',0x60,'Niantic.Holoholo.Map.IPoiSpinner'),result:enumI32Field(classes[SPINRESULT],'Result',0x10)};

   const ek=api.class_from_type(api.field_get_type(sf.result)),lit=api.class_get_field_from_name(ek,Memory.allocUtf8String('Success'));

   if(lit.isNull()||!api.field_get_parent(lit).equals(ek)||(api.field_get_flags(lit)&0x8050)!==0x8050)throw Error('spin-success-literal');

   const v=Memory.alloc(4);api.field_static_get_value(lit,v);

   spin={fields:sf,success:v.readS32(),methods:{

    enter:method(classes[SPINSTATE],'EnterState','System.Void',[],false,[0xa4ea31c,'ffc302d1fd7b05a9fc6f06a9fa6707a9f85f08a9f65709a9']),

    exit:method(classes[SPINSTATE],'ExitState','System.Void',[],false,[0xa4eb840,'fd7bbaa9fc6f01a9fa6702a9f85f03a9f65704a9f44f05a9']),

    result:method(classes[SPINSTATE],'bgff','System.Void',[SPINRESULT],false,[0xa4ec468,'ffc301d1fe6f02a9fa6703a9f85f04a9f65705a9f44f06a9']),

    close:method(classes[SPINGUI],'ClickExit','System.Void',[],false,[0xa4e5da4,'fe57bea9f44f01a9345f02f0f30300aa88f2673908010037']),

    spin:method(classes[SPINNER],'Spin','System.Void',['System.Single'],false,[0x9e63b34,'fe4fbfa9f30300aa51bcff977fc20339fe4fc1a8c0035fd6']),

    request:method(classes[SPINNER],'cnqj','System.Void',[],false,[0x9e63b54,'fe0f1df8f65701a9f44f02a9349302f0f30300aa88ce6139']),

    can:method(classes[SPINBASE],'get_CanSpin',BOOL,[],false,[0x9e514e8,'fe57bea9f44f01a9d49302b0f30300aa8832603908010037']),

    active:method(classes[GESTURE],'get_IsActive',BOOL,[],false,[0xa818d40,'00004239c0035fd6fe0f1df8f65701a9f44f02a9b54502b0'])}};

  }catch(e){spinError=String(e);}

  let spinCamera=null,spinCameraError=null;

  try{

   if(!spin||[APPROACH,RESOLVE,SPLINE].some(n=>!classes[n]))throw Error('spin-camera-classes');

   function cf(k,n,o,type){const f=raw(k,n,o);if(typeName(api,api.field_get_type(f))!==type)throw Error('spin-camera-field:'+n);return f;}

   const it=Memory.alloc(8);it.writePointer(ptr(0));let iterator=null;

   for(let i=0;i<256;i++){const k=api.class_get_nested_types(classes[SPLINE],it);if(k.isNull())break;if(/[.+/]cso$/.test(typeName(api,api.class_get_type(k)))&&api.class_get_declaring_type(k).equals(classes[SPLINE])){iterator=k;break;}}

   if(!iterator)throw Error('spin-camera-iterator');

   const owner=cf(iterator,'<>4__this',0x28,SPLINE),state=cf(iterator,'djjp',0x10,INT);

   cf(iterator,'djjv',0x50,'System.Single');

   spinCamera={iterator,owner,state,move:method(iterator,'MoveNext',BOOL,[],false,[0xa7b9460,'ffc302d1ea3300fde9a3066dfe3f00f9f85f08a9f65709a9']),states:[

    {klass:classes[APPROACH],phase:'in',camera:cf(classes[APPROACH],'splineCam',0x78,SPLINE),enter:method(classes[APPROACH],'EnterState','System.Void',[],false,[0xa4d166c,'ffc301d1fe2300f9f65705a9f44f06a9d45f02f0f30300aa']),exit:method(classes[APPROACH],'ExitState','System.Void',[],false,[0xa4d2174,'fe57bea9f44f01a9d45f02d0f30300aa889e663908010037'])},

    {klass:classes[RESOLVE],phase:'out',camera:cf(classes[RESOLVE],'splineCam',0x58,SPLINE),enter:method(classes[RESOLVE],'EnterState','System.Void',[],false,[0xa512b30,'fe57bea9f44f01a9d45d02d0f30300aa88ce6c3908010037']),exit:method(classes[RESOLVE],'ExitState','System.Void',[],false,[0xa51329c,'fe57bea9f44f01a9d45d02b0f30300aa88d26c3908010037'])}]};

  }catch(e){spinCameraError=String(e);}

  let items=null,itemsError=null;

  try{

   if([IBAG,ISERVICE,IRESPONSE,ITEM].some(n=>!classes[n]))throw Error('item-classes');

   function ityped(k,n,o,type){const f=o===null?api.class_get_field_from_name(k,Memory.allocUtf8String(n)):raw(k,n,o);if(f.isNull()||!api.field_get_parent(f).equals(k)||(api.field_get_flags(f)&0x50)||typeName(api,api.field_get_type(f))!==type)throw Error('item-field:'+n);return f;}

   const setType=n=>/^System\.Collections\.Generic\.ISet(?:`1)?<Holoholo\.Rpc\.Item>$/.test(n);

   const filterType=n=>/^System\.Func(?:`2)?<System\.ValueTuple(?:`2)?<Holoholo\.Rpc\.Item, ?Holoholo\.Rpc\.HoloItemType>, ?System\.Boolean>$/.test(n);

   const list=method(classes[ISERVICE],'cjpz',n=>/^System\.Collections\.Generic\.List(?:`1)?<.+ItemData>$/.test(n),[filterType,BOOL,filterType,n=>/^System\.Func(?:`2)?<Holoholo\.Rpc\.Item, ?System\.Boolean>$/.test(n),n=>/^System\.Action(?:`1)?<Holoholo\.Rpc\.Item>$/.test(n)],false,[163091344, "ff0307d1eaa300fde923156dfd7b16a9fc6f17a9fa6718a9"]);

   const lk=api.class_from_type(api.method_get_return_type(list.method)),get=api.class_get_method_from_name(lk,Memory.allocUtf8String('get_Item'),1),dk=api.class_from_type(api.method_get_return_type(get)),dn=typeName(api,api.class_get_type(dk));

   if(!/[.+/]ItemData$/.test(dn)&&dn!=='ItemData')throw Error('item-data-class');

   const nested=Memory.alloc(8);nested.writePointer(ptr(0));let cb=null;

   for(let i=0;i<256;i++){const k=api.class_get_nested_types(classes[IBAG],nested);if(k.isNull())break;if(/[.+/]wy$/.test(typeName(api,api.class_get_type(k)))&&api.class_get_declaring_type(k).equals(classes[IBAG])){cb=k;break;}}

   if(!cb)throw Error('item-callback-class');

   const prediction=ityped(cb,'prediction',0x18,'Holoholo.Rpc.HoloInventoryItemProto'),pk=api.class_from_type(api.field_get_type(prediction));

   const proto=method(pk,'get_Item','Holoholo.Rpc.ItemProto',[],false,null),ik=api.class_from_type(api.method_get_return_type(proto.method));

   const fields={delegateMethod:raw(classes[DELEGATE],'method',0x28),delegateTarget:raw(classes[DELEGATE],'m_target',0x20),bag:ityped(classes[ISERVICE],'ehsf',0x60,'Niantic.Holoholo.IItemBag'),id:enumI32Field(dk,'item',0x10),count:ityped(dk,'count',0x1c,INT),recyclable:ityped(dk,'recyclable',0x21,BOOL),callbackBag:ityped(cb,'<>4__this',0x10,IBAG),prediction,proto,protoId:ityped(ik,'Item',0x10,ITEM),status:enumI32Field(classes[IRESPONSE],'Result',0x10)};

   const ek=api.class_from_type(api.field_get_type(fields.status)),lit=api.class_get_field_from_name(ek,Memory.allocUtf8String('Success'));if(lit.isNull()||(api.field_get_flags(lit)&0x8050)!==0x8050)throw Error('item-success');const v=Memory.alloc(4);api.field_static_get_value(lit,v);

   const names={};const getFields=new NativeFunction(module.findExportByName('il2cpp_class_get_fields'),'pointer',['pointer','pointer']),getName=new NativeFunction(module.findExportByName('il2cpp_field_get_name'),'pointer',['pointer']);const ei=Memory.alloc(8);ei.writePointer(ptr(0));

   for(let i=0;i<2048;i++){const f=getFields(classes[ITEM],ei);if(f.isNull())break;if((api.field_get_flags(f)&0x8050)!==0x8050)continue;api.field_static_get_value(f,v);names[v.readS32()]=text(getName(f)).replace(/^Item/,'').replace(/([a-z0-9])([A-Z])/g,'$1 $2');}

   Object.assign(names,{1:'Poke Ball',401:'Incense',501:'Lure Module'});

   let lookup=null;try{

    const enumerate=new NativeFunction(module.findExportByName('il2cpp_class_get_methods'),'pointer',['pointer','pointer']);

    function select(k,n,ret,param,stat){const it=Memory.alloc(8);it.writePointer(ptr(0));for(let i=0;i<4096;i++){const m=enumerate(k,it);if(m.isNull())break;const impl=Memory.alloc(4);if(text(api.method_get_name(m))===n&&!api.method_is_generic(m)&&api.method_get_param_count(m)===param.length&&typeName(api,api.method_get_return_type(m))===ret&&Boolean(api.method_get_flags(m,impl)&16)===stat&&param.every((t,j)=>typeName(api,api.method_get_param(m,j))===t))return{method:m};}throw Error('item-lookup-method:'+n);}

   const map=classes['Niantic.Holoholo.MapSceneContext'],ctx=classes['Zenject.SceneContext'],container=classes['Zenject.DiContainer'],contract=classes['Niantic.Holoholo.UI.Items.IItemInventoryService'];if(map&&ctx&&container&&contract){

    const gui=classes['Niantic.Holoholo.UI.Items.ItemInventoryGuiService'],guiContract=classes['Niantic.Holoholo.UI.Items.IItemInventoryGuiService'];if(!gui||!guiContract)throw Error('item-gui-service');

    const ni=Memory.alloc(8);ni.writePointer(ptr(0));let singleton=null;for(let i=0;i<256;i++){const k=api.class_get_nested_types(gui,ni);if(k.isNull())break;if(/[.+/]<>c$/.test(typeName(api,api.class_get_type(k)))&&api.class_get_declaring_type(k).equals(gui)){singleton=k;break;}}if(!singleton)throw Error('item-filter-singleton');

    const tuple=n=>/^System\.ValueTuple(?:`2)?<Holoholo\.Rpc\.Item, ?Holoholo\.Rpc\.HoloItemType>$/.test(n);

    const usable=method(gui,'cjpm',BOOL,[tuple],false,[163081096, "fe5fbda9f65701a9f44f02a916aa02f034fc60d3f50301aa"]),show=method(singleton,'cjpd',BOOL,[tuple],false,[163083736, "20008052c0035fd6fe5fbda9f65701a9f44f02a916aa02d0"]);

    const instance=api.class_get_field_from_name(singleton,Memory.allocUtf8String('<>9'));if(instance.isNull()||!api.field_get_parent(instance).equals(singleton)||!(api.field_get_flags(instance)&16))throw Error('item-filter-instance');

    lookup={map,contract,gui,guiContract,singleton,instance,usable,show,funcType:api.method_get_param(list.method,0),

    reflect:new NativeFunction(module.findExportByName('il2cpp_method_get_object'),'pointer',['pointer','pointer']),initClass:new NativeFunction(module.findExportByName('il2cpp_runtime_class_init'),'void',['pointer']),

    createDelegate:select(classes[DELEGATE],'CreateDelegate','System.Delegate',['System.Type','System.Object','System.Reflection.MethodInfo'],true),typeObject:new NativeFunction(module.findExportByName('il2cpp_type_get_object'),'pointer',['pointer']),find:select(classes[OBJ],'FindObjectOfType',OBJ,['System.Type'],true),container:method(ctx,'get_Container','Zenject.DiContainer',[],false,null),resolve:select(container,'Resolve','System.Object',['System.Type'],false)};

   }}catch(_){}

   items={fields,dk,cb,names,lookup,success:(()=>{api.field_static_get_value(lit,v);return v.readS32();})(),methods:{list,

    init:method(classes[ISERVICE],'cjpx','System.Void',[],false,ITEMCODE.cjpx),

    count:method(lk,'get_Count',INT,[],false,null,true),get:method(lk,'get_Item',dn,[INT],false,null,true),

    expiring:method(classes[ISERVICE],'get_ExpiringItemsCopy',setType,[],false,ITEMCODE.get_ExpiringItemsCopy),

    quantity:method(classes[IBAG],'GetItemCount',INT,[ITEM],false,ITEMCODE.GetItemCount),

    recycle:method(classes[IBAG],'RecycleItem',n=>/^Niantic\.Promises\.IPromise(?:`1)?<Holoholo\.Rpc\.RecycleItemOutProto>$/.test(n),[dn,INT,setType],false,ITEMCODE.RecycleItem),

    result:method(cb,'zid','System.Void',[IRESPONSE],false,ITEMCODE.zid),error:method(cb,'zie','System.Void',['System.String'],false,ITEMCODE.zie)}};

  }catch(e){itemsError=String(e);}

  let rocket=null,rocketError=null;

  try{

   if([ROCKET,RUI,RDIR,RCHARGE,RSHIELD,'UnityEngine.UI.Selectable'].some(n=>!classes[n]))throw Error('rocket-classes-unavailable');

   function rm(k,o,n,ret,params=[]){return method(classes[k],n,ret,params,false,ROCKETCODE[o+':'+n]);}

   function rf(k,n,off,type){const f=raw(classes[k],n,off);if(typeName(api,api.field_get_type(f))!==type)throw Error('rocket-field:'+n);return f;}

   const vm=(k,o,n,ret,params=[])=>method(classes[k],n,ret,params,false,RVCode[o+':'+n]);

   const vnext={fields:{gesture:refField(classes[RVUI],'eovv',0x260),enabled:rf(RVBASE,'FastAttackInputEnabled',0x9a,BOOL),tap:refField(classes[RVBASE],'tapGesture',0x70),button:refField(classes[RVCHARGE],'attackButton',0x28)},methods:{update:vm(RVUI,31113,'UpdateUiWidgets','System.Void',['Niantic.Holoholo.VNext.BattleState']),close:vm(RVUI,31113,'HandleDismiss','System.Void'),blocked:vm(RVUI,31113,'get_IsInputBlocked',BOOL),fast:vm(RVGEST,31443,'cqul','System.Void',['System.Object']),observe:vm(RVCHARGE,31616,'ObserveBattleState','System.Void',['Niantic.Holoholo.VNext.BattleState']),charge:vm(RVCHARGE,31616,'ChargeAttackButtonTapped','System.Void'),charged:vm(RVCHARGE,31616,'get_IsCharged',BOOL),visible:vm(RVCHARGE,31616,'get_IsVisible',BOOL)}};

   const vector=classes['UnityEngine.Vector3'];if(!vector||api.class_value_size(vector,align)!==12)throw Error('minigame-vector-abi');

   const mini={fields:{collider:refField(classes[RMINI],'tapCollider',0xd8),running:rf(RMINIBASE,'combatIsRunning',0xb0,BOOL)},methods:{

    update:method(classes[RMINI],'UpdateMinigame','System.Void',['System.Int64'],false,RMCode.UpdateMinigame),exit:method(classes[RMINI],'ExitGame','System.Void',[],false,RMCode.ExitGame),hide:method(classes[RMINI],'Hide','System.Void',[],false,RMCode.Hide),destroy:method(classes[RMINI],'OnDestroy','System.Void',[],false,RMCode.OnDestroy),

    transform:method(classes['UnityEngine.Component'],'get_transform','UnityEngine.Transform',[],false,null),gameObject:method(classes['UnityEngine.Component'],'get_gameObject','UnityEngine.GameObject',[],false,null),

    scale:method(classes['UnityEngine.Transform'],'get_localScale','UnityEngine.Vector3',[],false,null),setScale:method(classes['UnityEngine.Transform'],'set_localScale','System.Void',['UnityEngine.Vector3'],false,null),active:method(classes['UnityEngine.GameObject'],'get_activeSelf',BOOL,[],false,null),setActive:method(classes['UnityEngine.GameObject'],'SetActive','System.Void',[BOOL],false,null)}};

   rocket={vnext,mini,fields:{first:refField(classes[RUI],'dofo',0x2c0),second:refField(classes[RUI],'dofp',0x2c8),charged:rf(RCHARGE,'<IsCharged>k__BackingField',0x1a0,BOOL),input:rf(RCHARGE,'<InputEnabled>k__BackingField',0x1a3,BOOL),shields:rf(RSHIELD,'dnve',0x178,INT),button:refField(classes[RSHIELD],'shieldButton',0x118)},methods:{

    enter:rm(ROCKET,7137,'EnterState','System.Void',['Niantic.Platform.GameStates.StateLogic.IStateApi',n=>n===ROCKET+'.Data']),exit:rm(ROCKET,7137,'ExitState','System.Void'),

    update:rm(RUI,7100,'UpdateActionsUI','System.Void',[BOOL]),ui:rm(RUI,7100,'Initialize','System.Void',[n=>n===RUI+'.Data']),close:rm(RUI,7100,'HandleDismiss','System.Void'),director:rm(RUI,7100,'bpro','Niantic.Holoholo.Combat.ICombatDirectorV2'),

    active:rm(RDIR,6533,'get_IsInActiveState',BOOL),fast:rm(RDIR,6533,'TryFastAttack','Holoholo.Rpc.CombatActionProto'),

    charge:rm(RCHARGE,7064,'OnTap','System.Void'),visible:rm(RCHARGE,7064,'get_IsVisible',BOOL),

    prompt:rm(RSHIELD,6971,'ShowShieldPrompt','System.Void',[BOOL]),shield:rm(RSHIELD,6971,'ShieldUiClicked','System.Void'),shieldClose:rm(RSHIELD,6971,'HandleDismiss','System.Void'),

    interactable:method(classes['UnityEngine.UI.Selectable'],'IsInteractable',BOOL,[],false,null)}};

  }catch(e){rocketError=String(e);}

  let battles=null,battlesError=null;

  try{

   if(!rocket||!rocket.vnext)throw Error('vnext-attack-support');

   const bk=o=>classes[BATTLE_TYPES[o]||RVBASE];

   const bm=(o,n,ret,params=[])=>method(bk(o),n,ret,params,false,BATTLE_CODE[o+':'+n]);

   const scopes=[{mode:0,klass:bk(31514),enter:bm(31514,'EnterState','System.Void',['Niantic.Platform.GameStates.StateLogic.IStateApi','Niantic.Holoholo.Raid.RaidBattleLaunchData']),exit:bm(31514,'ExitState','System.Void')},

    {mode:1,klass:bk(10591),enter:bm(10591,'EnterState','System.Void'),exit:bm(10591,'ExitState','System.Void')},

    {mode:2,klass:bk(31244),enter:bm(31244,'EnterState','System.Void',['Niantic.Platform.GameStates.StateLogic.IStateApi','Niantic.Holoholo.Bread.BreadLaunchData']),exit:bm(31244,'ExitState','System.Void')}];

   const maxType=enumI32Field(bk(31280),'<ActiveBreadMoveType>k__BackingField',0x134),enumClass=api.class_from_type(api.field_get_type(maxType)),lit=api.class_get_field_from_name(enumClass,Memory.allocUtf8String('BreadAttack'));

   if(lit.isNull()||(api.field_get_flags(lit)&0x8050)!==0x8050)throw Error('max-attack-literal');const value=Memory.alloc(4);api.field_static_get_value(lit,value);

   const dodge= bm(31351,'cqpd','System.Void',[n=>/[.+/]Direction$/.test(n)]),direction=api.class_from_type(api.method_get_param(dodge.method,0));

   if(!api.class_is_enum(direction)||typeName(api,api.class_enum_basetype(direction))!==INT)throw Error('dodge-direction-type');

   const left=api.class_get_field_from_name(direction,Memory.allocUtf8String('Left')),leftValue=Memory.alloc(4);

   if(left.isNull()||(api.field_get_flags(left)&0x8050)!==0x8050)throw Error('dodge-left-literal');api.field_static_get_value(left,leftValue);

   let gymIterator=null;const gi=Memory.alloc(8);gi.writePointer(ptr(0));for(let i=0;i<64;i++){const k=api.class_get_nested_types(bk(9284),gi);if(k.isNull())break;if(/[.+/]epg$/.test(typeName(api,api.class_get_type(k)))){gymIterator=k;break;}}

   if(!gymIterator)throw Error('gym-warning-iterator');

   const gymWarning=method(gymIterator,'MoveNext',BOOL,[],false,BATTLE_CODE['9283:MoveNext']),gymWarningState=raw(gymIterator,'duwi',0x10);

   const battleStatus=enumI32Field(bk(44226),'BattleStatus',0x64),statusClass=api.class_from_type(api.field_get_type(battleStatus));

   function battleStatusValue(name){const f=api.class_get_field_from_name(statusClass,Memory.allocUtf8String(name)),v=Memory.alloc(4);if(f.isNull()||(api.field_get_flags(f)&0x8050)!==0x8050)throw Error('battle-status:'+name);api.field_static_get_value(f,v);return v.readS32();}

   battles={scopes,statusActive:battleStatusValue('Active'),statusUnset:battleStatusValue('Unset'),dodgeLeft:leftValue.readS32(),gymIterator,gymWarningState,maxAttack:value.readS32(),fields:{director:refField(bk(31351),'epus',0x20),battleStatus,legacyFlick:refField(bk(9182),'horizontalFlickGesture',0x60),legacyTap:refField(bk(9182),'tapGesture',0x58),legacyButton:refField(bk(9308),'attackButton',0x28),maxButton:refField(bk(31280),'button',0x98),maxType},methods:{

    currentState:bm(31569,'get_CurrentState',BATTLE_TYPES[44226]),raidFastAction:bm(31351,'cqpa','System.Void'),destroy:bm(31351,'OnDestroy','System.Void'),dodge,gymWarning,raidWarning:bm(31623,'crlu','System.Void'),maxWarning:bm(31263,'cqim','System.Void',['System.Single']),legacyDodge:bm(9182,'bwqu','System.Void',['System.Object','System.EventArgs']),

    enable:bm(31351,'OnEnable','System.Void'),disable:bm(31351,'OnDisable','System.Void'),buttons:bm(31351,'SetChargeAttackButtons','System.Void',[RVCHARGE+'[]']),

    raidFast:bm(31499,'cqjz','System.Void',['System.Object','System.EventArgs']),maxFast:bm(31285,'cqjz','System.Void',['System.Object','System.EventArgs']),

    legacyEnable:bm(9182,'OnEnable','System.Void'),legacyDisable:bm(9182,'OnDisable','System.Void'),legacyButtons:bm(9182,'SetChargeAttackButtons','System.Void',[BATTLE_TYPES[9308]+'[]']),legacyFast:bm(9182,'bwqr','System.Void',['System.Object','System.EventArgs']),

    legacyInit:bm(9308,'Init','System.Void',['Niantic.Holoholo.Battle.BattlePokemon','Niantic.Holoholo.Battle.BattlePokemon','UnityEngine.Vector3']),legacyCharged:bm(9308,'get_IsCharged',BOOL),legacyCharge:bm(9308,'ChargeAttackButtonTapped','System.Void'),

    maxRefresh:bm(31280,'Refresh','System.Void',[n=>n===BATTLE_TYPES[31280]+'.Data']),maxCleanup:bm(31280,'Cleanup','System.Void'),

    active:method(classes['UnityEngine.Behaviour'],'get_isActiveAndEnabled',BOOL,[],false,null),press:method(classes['UnityEngine.UI.Button'],'Press','System.Void',[],false,null)}};

  }catch(e){battlesError=String(e);}

  let berries=null,berriesError=null;

  try{if(!items)throw Error('item-bag-unavailable');const k=classes[BERRY],bm=(n,ret,params=[])=>method(k,n,ret,params,false,BERRY_CODE[n]);

   for(const [name,offset]of [['confirmationDelay',0x108],['postConfirmationDelay',0x10c]]){const f=raw(classes[FEEDGUI],name,offset);if(typeName(api,api.field_get_type(f))!=='System.Single')throw Error('berry-delay-type');}

   berries={fields:{image:refField(classes[FEEDGUI],'itemImage',0xf0),bag:refField(k,'drql',0x148),gui:refField(k,'drrv',0x248),ui:refField(k,'<EncounterUI>k__BackingField',0x298),current:enumI32Field(k,'<CurrentItem>k__BackingField',0x2a8)},methods:{visible:method(classes['UnityEngine.Behaviour'],'get_enabled',BOOL,[],false,null),setVisible:method(classes['UnityEngine.Behaviour'],'set_enabled','System.Void',[BOOL],false,null),enter:bm('EnterState','System.Void'),exit:bm('ExitState','System.Void'),select:bm('SelectBerry','System.Void',[ITEM]),can:bm('get_CanUseBerry',BOOL),ball:bm('get_PokeballInPlay',BOOL),photo:bm('get_IsInPhotoMode',BOOL),confirm:method(classes[FEEDGUI],'ClickConfirm','System.Void',[],false,BERRY_CODE.ClickConfirm)}};

   const ball=classes['Niantic.Holoholo.Encounter.Pokeball'],throwName='Niantic.Holoholo.Encounter.PokeballThrow',throwClass=classes[throwName],va=Memory.alloc(4);if(!api.class_is_valuetype(throwClass)||api.class_value_size(throwClass,va)!==12||va.readU32()!==4)throw Error('berry-impact-throw-abi');

   for(const [n,type,off]of [['BallType',ITEM,16],['ReticleSize','System.Single',20],['HitBullseye',BOOL,24],['Spinning',BOOL,25],['Missed',BOOL,26]])if(typeName(api,api.field_get_type(raw(throwClass,n,off)))!==type)throw Error('berry-impact-throw-field:'+n);

   let callback=null;const bi=Memory.alloc(8);bi.writePointer(ptr(0));for(let i=0;i<64;i++){const c=api.class_get_nested_types(k,bi);if(c.isNull())break;if(/[.+/]ebn$/.test(typeName(api,api.class_get_type(c)))&&api.class_get_declaring_type(c).equals(k)){callback=c;break;}}if(!callback)throw Error('berry-confirm-callback');

   berries.callback=callback;berries.fields.callbackScope=refField(callback,'<>4__this',0x10);berries.fields.callbackBerry=enumI32Field(callback,'berryType',0x18);

   berries.methods.direct=method(callback,'btdx','System.Void',[BOOL],false,BERRY_THROW_CODE.btdx);

   berries.methods.result=method(callback,'btdy','System.Void',['Holoholo.Rpc.UseItemEncounterOutProto'],false,BERRY_THROW_CODE.btdy);berries.methods.error=method(callback,'btdz','System.Void',['System.String'],false,BERRY_THROW_CODE.btdz);

   berries.methods.submit=method(ball,'btyl','System.Void',[throwName],false,BERRY_THROW_CODE.submit);berries.methods.peek=method(ball,'btxu','Holoholo.Rpc.CatchPokemonOutProto',[],false,BERRY_THROW_CODE.peek);

   berries.methods.bread=method(ball,'get_HoldingBreadBall',BOOL,[],false,BERRY_THROW_CODE.get_HoldingBreadBall);berries.methods.ballType=method(ball,'get_BallType',ITEM,[],false,BERRY_THROW_CODE.get_BallType);

  }catch(e){berries=null;berriesError=String(e);}


  let incubator=null,incubatorError=null;
  try{
   const service='Niantic.Holoholo.Items.IncubatorService',contract='Niantic.Holoholo.Items.IIncubatorService',inc='Holoholo.Rpc.EggIncubatorProto';
   if(!items||!items.lookup||![service,contract,inc,'System.Collections.IEnumerable',VGP.player,VGP.playerContract,VGP.bagContract].every(n=>classes[n]))throw Error('incubator-dependencies');
   const typed=(k,n,o,ty)=>{const f=raw(classes[k],n,o);if(typeName(api,api.field_get_type(f))!==ty)throw Error('incubator-field:'+n);return f;};
   const literal=(k,n)=>{const f=api.class_get_field_from_name(k,Memory.allocUtf8String(n)),v=Memory.alloc(4);if(f.isNull()||(api.field_get_flags(f)&0x8050)!==0x8050)throw Error('incubator-enum:'+n);api.field_static_get_value(f,v);return v.readS32();};
   const f={egg:typed(PK,'isEgg_',0x50,BOOL),id:typed(PK,'id_',0x20,'System.UInt64'),target:typed(PK,'eggKmWalkedTarget_',0x58,'System.Double'),start:typed(PK,'eggKmWalkedStart_',0x60,'System.Double'),assignment:typed(PK,'eggIncubatorId_',0x98,'System.String'),eggType:enumI32Field(classes[PK],'eggType_',0x154),item:typed(inc,'Item',0x18,ITEM),incId:typed(inc,'ItemId',0x10,'System.String'),pokemonId:typed(inc,'PokemonId',0x28,'System.Int64'),expiry:typed(inc,'UnconvertedLocalExpirationTimeMs',0x40,'System.Int64')};
   const m={put:method(classes[service],'PutEggInIncubator',n=>/^Niantic\.Promises\.IPromise(?:`1)?<Holoholo\.Rpc\.UseItemEggIncubatorOutProto>$/.test(n),['System.Int64',inc],false,[163477644,'ffc301d1fe1300f9fa6703a9f85f04a9f65705a9f44f06a914a702d0f60302aa']),
    incubators:method(classes[VGP.player],'get_Incubators',n=>/^System\.Collections\.Generic\.IEnumerable(?:`1)?<Holoholo\.Rpc\.EggIncubatorProto>$/.test(n),[],false,[178505260,'fe57bea9f44f01a9943402d0f30300aa88125c3908010037200b02b000801b91']),
    eggs:method(classes[BAG],'get_AllPokemon',n=>/^System\.Collections\.Generic\.ICollection(?:`1)?<Holoholo\.Rpc\.PokemonProto>$/.test(n),[],false,[168081584,'fe0f1df8f65701a9f44f02a914840290f30300aa889a4f3908010037e05b02f0']),
    enumerate:method(classes['System.Collections.IEnumerable'],'GetEnumerator','System.Collections.IEnumerator',[],false,null),
    move:method(classes['System.Collections.IEnumerator'],'MoveNext',BOOL,[],false,null),
    current:method(classes['System.Collections.IEnumerator'],'get_Current','System.Object',[],false,null),
    dispose:method(classes['System.IDisposable'],'Dispose','System.Void',[],false,null)};
   incubator={service,contract,inc,f,m,unlimited:literal(classes[ITEM],'IncubatorBasicUnlimited'),special:literal(api.class_from_type(api.field_get_type(f.eggType)),'EggTypeSpecial')};
  }catch(e){incubatorError=String(e);incubator=null;}

  let buddy=null,buddyError=null;

  try{if(!items||!items.lookup)throw Error('buddy-item-lookup');

   const bm=(o,n,ret,params=[],stat=false)=>method(classes[BUDDY_TYPES[o]],n,ret,params,stat,BUDDY_CODE[o+'.'+n]);

   const bf=(o,n,off)=>refField(classes[BUDDY_TYPES[o]],n,off),stats='Holoholo.Rpc.BuddyObservedData';

   let callback=null;const it=Memory.alloc(8);it.writePointer(ptr(0));for(let i=0;i<64;i++){const k=api.class_get_nested_types(classes[BUDDY_TYPES[7768]],it);if(k.isNull())break;if(/[.+/]dvh$/.test(typeName(api,api.class_get_type(k)))&&api.class_get_declaring_type(k).equals(classes[BUDDY_TYPES[7768]])){callback=k;break;}}

   if(!callback)throw Error('buddy-feed-callback');

   const result=enumI32Field(classes['Holoholo.Rpc.BuddyFeedingOutProto'],'Result',0x10),ek=api.class_from_type(api.field_get_type(result)),lit=api.class_get_field_from_name(ek,Memory.allocUtf8String('Success')),v=Memory.alloc(4);

   if(lit.isNull()||(api.field_get_flags(lit)&0x8050)!==0x8050)throw Error('buddy-feed-success');api.field_static_get_value(lit,v);

   buddy={success:v.readS32(),callback,contract:classes['Niantic.Holoholo.Buddy.IBuddyStatsService'],fields:{rpc:bf(7769,'dpsj',0x58),pokemon:bf(7769,'dpsi',0x50),bag:bf(7768,'dpsh',0x40),callbackRpc:refField(callback,'<>4__this',0x18),result,buddyId:raw(classes['Holoholo.Rpc.BuddyPokemonProto'],'BuddyPokemonId',0x10),feedStats:refField(classes[stats],'BuddyFeedStats',0x40)},methods:{

    stats:bm(7769,'get_BuddyStats',stats),has:bm(8109,'get_HasBuddy',BOOL),pokemon:bm(8109,'get_BuddyPokemon','Holoholo.Rpc.BuddyPokemonProto'),

    remaining:bm(7757,'OnMapRemainingSec','System.Single',[stats],true),fullness:bm(7757,'PreMapFullnessPercentage','System.Single',[stats],true),cooldown:bm(7757,'InFullnessCooldown',BOOL,[stats],true),

    feed:bm(7768,'Feed',n=>/^Niantic\.Promises\.IPromise(?:`1)?<Holoholo\.Rpc\.BuddyFeedingOutProto>$/.test(n),[ITEM,INT]),result:method(callback,'brhd','System.Void',['Holoholo.Rpc.BuddyFeedingOutProto'],false,BUDDY_CODE['7763.brhd'])}};

   if(typeName(api,api.field_get_type(buddy.fields.buddyId))!=='System.UInt64')throw Error('buddy-id-type');

  }catch(e){buddy=null;buddyError=String(e);}

  let gifts=null,giftsError=null;

  try{

   const gm=(o,n,ret,params=[])=>method(classes[GIFT_TYPES[o]],n,ret,params,false,GIFT_CODE[o+'.'+n]);

   const gf=(o,n,off)=>refField(classes[GIFT_TYPES[o]],n,off);

   const data=gf(5936,'thisData',0x460),dataClass=api.class_from_type(api.field_get_type(data));

   const panelFriend=refField(dataClass,'FriendProto',0x18);

   const friendClass=classes['Niantic.Platform.Internal.Protos.FriendDetailsProto'],playerClass=classes['Niantic.Platform.Internal.Protos.PlayerSummaryProto'];

   const ms={profileOpen:gm(5916,'HandleOpenComplete','System.Void'),profileClose:gm(5916,'HandleDismiss','System.Void'),panel:gm(5916,'get_CurrentlyOpenFriendProfileInfoPanel',GIFT_TYPES[5936]),disabled:gm(5916,'get_ActionButtonsDisabled',BOOL),check:gm(5936,'CheckOnGift',BOOL),choose:gm(5936,'OnGiftClick','System.Void'),

    openReady:gm(6240,'HandleOpenComplete','System.Void'),openClose:gm(6240,'HandleDismiss','System.Void'),open:gm(6240,'OnOpenClick','System.Void'),

    sendReady:gm(6258,'HandleOpenComplete','System.Void'),sendClose:gm(6258,'HandleDismiss','System.Void'),send:gm(6258,'OnSendClick','System.Void'),stickers:gm(6258,'OnStickersClick','System.Void'),

    listInit:gm(6268,'Initialize','System.Void',[n=>n.endsWith('.Data')]),listReady:gm(6268,'HandleOpenComplete','System.Void'),listClose:gm(6268,'HandleDismiss','System.Void'),

    giftUpdate:gm(6211,'UpdateData','System.Void',[INT,'Holoholo.Rpc.GiftBoxDetailsProto']),giftBox:gm(6211,'GiftBox','Holoholo.Rpc.GiftBoxDetailsProto',[INT]),giftClick:gm(6211,'OnClick','System.Void',[INT]),

    stickerInit:gm(6176,'Reinitialize','System.Void',[n=>n.endsWith('.Initializer')]),stickerClick:gm(6176,'Click','System.Void'),sheetReady:gm(6195,'HandleOpenComplete','System.Void'),sheetClose:gm(6195,'HandleDismiss','System.Void'),

    inventory:gm(6164,'GetStickerInventory',n=>/^System\.Collections\.Generic\.List(?:`1)?<Holoholo\.Rpc\.StickerProto>$/.test(n),[BOOL]),selectSticker:gm(6258,'bmzx','System.Void',['Holoholo.Rpc.StickerProto']),

    quantity:gm(6164,'StickerCountExcludingReserved',INT,['Holoholo.Rpc.StickerProto']),anyStickers:gm(6164,'AnyStickers',BOOL),

    active:method(classes['UnityEngine.Behaviour'],'get_isActiveAndEnabled',BOOL,[],false,null),interactable:method(classes['UnityEngine.UI.Selectable'],'IsInteractable',BOOL,[],false,null)};

   const listData=api.class_from_type(api.method_get_param(ms.listInit.method,0));

   const typed=(k,n,off,ty)=>{const f=raw(k,n,off);if(typeName(api,api.field_get_type(f))!==ty)throw Error('gift-field-type:'+n);return f;};

   gifts={methods:ms,fields:{data,panelFriend,player:refField(friendClass,'player_',0x18),playerId:typed(playerClass,'playerId_',0x18,'System.String'),

    sender:typed(classes['Holoholo.Rpc.GiftBoxDetailsProto'],'SenderId',0x18,'System.String'),openDetails:gf(6240,'dlst',0x290),

    sendFriend:gf(6258,'dlvg',0x2d0),sendSticker:gf(6258,'dlvh',0x2d8),stickerService:gf(6258,'dluq',0x250),

    openButton:gf(6240,'openButton',0x150),sendButton:gf(6258,'sendButton',0x118),chooseButton:gf(5936,'sendGiftButton',0x160),stickerButton:gf(6258,'stickerButton',0x150),

    widgetButton:gf(6176,'button',0x70),widgetSticker:gf(6176,'dlla',0x118),

    deleteMode:typed(listData,'ShowDeleteIcon',0x18,BOOL),surprise:typed(listData,'IsSurprise',0x28,BOOL)}};

   const ff=gifts.fields,mm=gifts.methods;gifts.stickerListClass=api.class_from_type(api.method_get_return_type(mm.inventory.method));

   mm.stickerCount=method(gifts.stickerListClass,'get_Count',INT,[],false,null,true);mm.stickerItem=method(gifts.stickerListClass,'get_Item','Holoholo.Rpc.StickerProto',[INT],false,null,true);let sequence=null;const si=Memory.alloc(8);si.writePointer(ptr(0));

   for(let i=0;i<64;i++){const k=api.class_get_nested_types(classes[GIFT_TYPES[6240]],si);if(k.isNull())break;if(/[.+/]ddh$/.test(typeName(api,api.class_get_type(k)))&&api.class_get_declaring_type(k).equals(classes[GIFT_TYPES[6240]])){sequence=k;break;}}

   if(!sequence)throw Error('gift-presentation-iterator-missing');classes[GIFT_OPEN_SEQUENCE]=sequence;

   ff.sequenceGui=refField(sequence,'<>4__this',0x20);ff.sequenceResponse=refField(sequence,'response',0x28);ff.sequenceState=typed(sequence,'dlrm',0x10,INT);

   ff.openResult=enumI32Field(classes['Holoholo.Rpc.OpenGiftOutProto'],'Result',0x10);

   const ek=api.class_from_type(api.field_get_type(ff.openResult)),lit=api.class_get_field_from_name(ek,Memory.allocUtf8String('Success')),ev=Memory.alloc(4);

   if(lit.isNull()||!api.field_get_parent(lit).equals(ek)||(api.field_get_flags(lit)&0x8050)!==0x8050)throw Error('gift-success-literal');api.field_static_get_value(lit,ev);gifts.openSuccess=ev.readS32();

   mm.sequence=method(sequence,'MoveNext',BOOL,[],false,GIFT_OPEN_SEQUENCE_CODE);

   ff.listItems=refField(listData,'GiftBoxDetailsProtos',0x20);gifts.listClass=api.class_from_type(api.field_get_type(ff.listItems));

   mm.listCount=method(gifts.listClass,'get_Count',INT,[],false,null,true);mm.listItem=method(gifts.listClass,'get_Item','Holoholo.Rpc.GiftBoxDetailsProto',[INT],false,null,true);

   ff.selected=gf(6268,'GiftBoxSelected',0x188);gifts.selectedClass=api.class_from_type(api.field_get_type(ff.selected));

   mm.selectFirst=method(gifts.selectedClass,'Invoke','System.Void',['Holoholo.Rpc.GiftBoxDetailsProto'],false,null,true);

   mm.listExit=gm(6268,'ExitGui','System.Void');mm.sendResult=gm(6258,'bnah','System.Void',['Holoholo.Rpc.SendGiftOutProto']);

   ff.sendResult=enumI32Field(classes['Holoholo.Rpc.SendGiftOutProto'],'Result',0x10);

   const sk=api.class_from_type(api.field_get_type(ff.sendResult)),sl=api.class_get_field_from_name(sk,Memory.allocUtf8String('Success'));if(sl.isNull()||(api.field_get_flags(sl)&0x8050)!==0x8050)throw Error('gift-send-success');api.field_static_get_value(sl,ev);gifts.sendSuccess=ev.readS32();

   ff.rows=gf(6268,'dlwk',0x1a0);ff.listSurprise=typed(classes[GIFT_TYPES[6268]],'dlwm',0x1b0,BOOL);

   gifts.rowsClass=api.class_from_type(api.field_get_type(ff.rows));mm.rowCount=method(gifts.rowsClass,'get_Count',INT,[],false,null,true);mm.rowItem=method(gifts.rowsClass,'get_Item','Niantic.Holoholo.Social.Gifting.UI.IGiftItemView2Widget',[INT],false,null,true);

   mm.rpcSend=gm(6149,'SendGift',n=>/^Niantic\.Promises\.IPromise(?:`1)?<Holoholo\.Rpc\.SendGiftOutProto>$/.test(n),['System.UInt64','System.String','System.String','Holoholo.Rpc.StickerProto',BOOL]);

   mm.sendable=gm(6154,'get_SendableGiftsInInventory',n=>/^System\.Collections\.Generic\.IEnumerable(?:`1)?<Holoholo\.Rpc\.GiftBoxProto>$/.test(n));

   mm.reserve=gm(6164,'ReserveStickers','System.Void',['System.String',INT]);mm.returnSticker=gm(6164,'ReturnReservedStickers','System.Void',['System.String',INT]);

   ff.panelGifting=gf(5936,'dkrv',0x2e0);ff.panelRpc=gf(5936,'dkrw',0x2e8);ff.rpcStickers=gf(6149,'dlil',0x30);

   ff.giftId=typed(classes['Holoholo.Rpc.GiftBoxProto'],'GiftboxId',0x10,'System.UInt64');ff.stickerId=typed(classes['Holoholo.Rpc.StickerProto'],'StickerId',0x10,'System.String');

   ff.checkResult=enumI32Field(classes[GIFT_TYPES[5936]],'dktn',0x450);ff.checkPending=typed(classes[GIFT_TYPES[5936]],'dkto',0x454,BOOL);

   const ck=api.class_from_type(api.field_get_type(ff.checkResult)),cl=api.class_get_field_from_name(ck,Memory.allocUtf8String('Success'));if(cl.isNull()||(api.field_get_flags(cl)&0x8050)!==0x8050)throw Error('gift-check-success');api.field_static_get_value(cl,ev);gifts.checkSuccess=ev.readS32();

   const iterable=api.class_from_type(api.method_get_return_type(mm.sendable.method));

   mm.getEnumerator=method(iterable,'GetEnumerator',n=>/^System\.Collections\.Generic\.IEnumerator(?:`1)?<Holoholo\.Rpc\.GiftBoxProto>$/.test(n),[],false,null,true);

   const enumerator=api.class_from_type(api.method_get_return_type(mm.getEnumerator.method));mm.currentGift=method(enumerator,'get_Current','Holoholo.Rpc.GiftBoxProto',[],false,null,true);

   mm.moveGift=method(classes['System.Collections.IEnumerator'],'MoveNext',BOOL,[],false,null);mm.disposeGift=method(classes['System.IDisposable'],'Dispose','System.Void',[],false,null);

   ff.niaUtil=gf(5936,'dksq',0x388);const nk=api.class_from_type(api.field_get_type(ff.niaUtil)),ni=Memory.alloc(8);ni.writePointer(ptr(0));

   for(let i=0;i<64;i++){const q=api.class_get_methods(nk,ni);if(q.isNull())break;if(text(api.method_get_name(q))==='GetPlayerIdOrNiaAccountId'&&api.method_get_param_count(q)===1&&typeName(api,api.method_get_param(q,0))==='Niantic.Platform.Internal.Protos.PlayerSummaryProto'&&typeName(api,api.method_get_return_type(q))==='System.String'){mm.niaId={method:q};break;}}

   if(!mm.niaId)throw Error('gift-nia-method');

   let callback=null;const ci=Memory.alloc(8);ci.writePointer(ptr(0));for(let i=0;i<64;i++){const k=api.class_get_nested_types(classes[GIFT_TYPES[6149]],ci);if(k.isNull())break;if(/[.+/]dcg$/.test(typeName(api,api.class_get_type(k)))&&api.class_get_declaring_type(k).equals(classes[GIFT_TYPES[6149]])){callback=k;break;}}

   if(!callback)throw Error('gift-send-callback');gifts.callbackClass=callback;ff.callbackService=refField(callback,'<>4__this',0x10);ff.callbackId=typed(callback,'playerId',0x18,'System.String');

   mm.rpcResult=method(callback,'bmnz','System.Void',['Holoholo.Rpc.SendGiftOutProto'],false,GIFT_CODE['6147.bmnz']);mm.rpcFinally=method(callback,'bmoa','System.Void',[],false,GIFT_CODE['6147.bmoa']);

   gifts.sendDelays=[['dlvj',0x2e4],['dlvk',0x2e8],['dlvl',0x2ec],['dlvm',0x2f0],['stickerButtonFadeDurationSeconds',0x160],['stickerButtonDelayBeforeFadeSeconds',0x164]].map(([n,off])=>{typed(classes[GIFT_TYPES[6258]],n,off,'System.Single');return off;});

  }catch(e){gifts=null;giftsError=String(e);}

  let spawn=null,spawnError=null;

  try{spawn=method(classes[SPAWN],'cmwe','System.Double',[],false,[0x9dd7438,'fe57bea9f44f01a9949702f0f30300aa88525639e8020037']);}catch(e){spawnError=String(e);}


  let vgp=null,vgpError=null;
  try{
   if(!items||Object.values(VGP).some(n=>!classes[n]))throw Error('vgp-dependencies');
   const m={},f={},k=n=>classes[VGP[n]];
   const typed=(owner,name,offset,type)=>{const f=raw(owner,name,offset);if(typeName(api,api.field_get_type(f))!==type)throw Error('vgp-field-type:'+name);return f;};
   const vm=(key,owner,name,ret,args=[])=>m[key]=method(owner,name,ret,args,false,null);
   vm('encounter',k('wild'),'SendEncounterRequest',n=>n.includes('<Niantic.Holoholo.Map.PokemonEncounterResponse>'));
   vm('capture',k('pokemon'),'TryCapture',n=>n.includes('<Holoholo.Rpc.CatchPokemonOutProto>'),['Niantic.Holoholo.Encounter.PokeballThrow','Holoholo.Rpc.ARPlusEncounterValuesProto']);
   vm('location',k('pokemon'),'get_Location','Niantic.LatLng');vm('id',k('wild'),'get_EncounterId','System.UInt64');vm('visible',k('wild'),'get_VisibleOnMap',BOOL);
   vm('maxItems',k('player'),'get_MaxItems',INT);vm('maxPokemon',k('player'),'get_MaxPokemon',INT);
   vm('itemCount',classes[IBAG],'GetItemCount',INT,[ITEM]);vm('totalItems',classes[IBAG],'GetTotalItems',INT);vm('pokemonCount',classes[BAG],'get_Count',INT);
   vm('active',k('place'),'get_IsActive',BOOL);vm('range',k('place'),'get_IsPlayerInRange',BOOL);vm('closed',k('place'),'get_IsClosed',BOOL);vm('cooling',k('place'),'get_IsCoolingDown',BOOL);
   vm('fort',k('place'),'get_FortData',VGP.fort);vm('cooldown',k('place'),'SetCooldownTime','System.Void',['System.Int64']);
   vm('ctor',k('request'),'.ctor','System.Void');const findIter=Memory.alloc(8);findIter.writePointer(ptr(0));
   for(let i=0;i<256;i++){const q=api.class_get_methods(classes[OBJ],findIter);if(q.isNull())break;if(text(api.method_get_name(q))==='FindObjectsOfType'&&!api.method_is_generic(q)&&api.method_get_param_count(q)===1&&typeName(api,api.method_get_param(q,0))==='System.Type'&&typeName(api,api.method_get_return_type(q))==='UnityEngine.Object[]'){m.findAll={method:q};break;}}
   if(!m.findAll)throw Error('vgp-find-objects');
   f.fortId=typed(k('fort'),'FortId',0x10,'System.String');f.fortLat=typed(k('fort'),'Latitude',0x20,'System.Double');f.fortLon=typed(k('fort'),'Longitude',0x28,'System.Double');
   f.id=typed(k('request'),'Id',0x10,'System.String');f.lat=typed(k('request'),'PlayerLatDegrees',0x18,'System.Double');f.lon=typed(k('request'),'PlayerLngDegrees',0x20,'System.Double');f.targetLat=typed(k('request'),'FortLatDegrees',0x28,'System.Double');f.targetLon=typed(k('request'),'FortLngDegrees',0x30,'System.Double');
   f.result=enumI32Field(classes[SPINRESULT],'Result',0x10);f.until=typed(classes[SPINRESULT],'CooldownComplete',0x38,'System.Int64');f.catchStatus=enumI32Field(classes[RESP],'Status',0x10);f.bagGm=typed(classes[BAG],'cypm',0x38,'IGameMasterData');
   const enumValue=(klass,name)=>{const q=api.class_get_field_from_name(klass,Memory.allocUtf8String(name)),b=Memory.alloc(4);if(q.isNull()||(api.field_get_flags(q)&0x8050)!==0x8050)throw Error('vgp-enum:'+name);api.field_static_get_value(q,b);return b.readS32();};
   const spinSuccess=enumValue(api.class_from_type(api.field_get_type(f.result)),'Success'),rpcId=enumValue(k('method'),'FortSearch');
   const catchStates={};for(const name of ['CatchSuccess','CatchEscape','CatchFlee','CatchMissed','CatchError','CatchItemReplacement'])catchStates[name]=enumValue(api.class_from_type(api.field_get_type(f.catchStatus)),name);
   const native=(name,ret,args)=>{const a=module.findExportByName('il2cpp_'+name);if(!a)throw Error('vgp-export:'+name);return new NativeFunction(a,ret,args,{scheduling:'exclusive',exceptions:'propagate'});};
   vgp={m,f,spinSuccess,rpcId,catchStates,parent:native('class_get_parent','pointer',['pointer']),array:native('array_new','pointer',['pointer','uint64']),barrier:native('gc_wbarrier_set_field','void',['pointer','pointer','pointer']),unreflect:native('method_get_from_reflection','pointer',['pointer'])};
  }catch(e){vgp=null;vgpError=String(e);}
  let mapPoi=null,mapPoiError=null;
  try {
   if(!vgp)throw Error('map-dependencies');
   const gym=classes['Niantic.Holoholo.Gym.MapGym'],raid=classes['Holoholo.Rpc.RaidInfoProto'];
   if(!gym||!raid)throw Error('map-classes');
   const field=(owner,name,types)=>{const f=api.class_get_field_from_name(owner,Memory.allocUtf8String(name));if(f.isNull()||(api.field_get_flags(f)&16)||!types.includes(typeName(api,api.field_get_type(f))))throw Error('map-field:'+name);return f;};
   mapPoi={gym,raid,info:field(classes[VGP.fort],'RaidInfo',['Holoholo.Rpc.RaidInfoProto']),end:field(raid,'RaidEndMs',['System.Int64','System.UInt64']),spawn:field(raid,'RaidSpawnMs',['System.Int64','System.UInt64']),battle:field(raid,'RaidBattleMs',['System.Int64','System.UInt64']),hidden:field(raid,'IsRaidHidden',[BOOL])};
   // Optional enrichment (raid tier/boss, gym team/slots). Any failure here degrades to the basic
   // marker set instead of disabling every POI, and enum text is resolved from the game's own static
   // constants rather than a guessed numeric mapping. Values are read non-static with the same field()
   // name/type/non-static validation as the core fields.
   try{
    const enumMap=(klass)=>{
     if(klass.isNull()||!api.class_is_enum(klass)||typeName(api,api.class_enum_basetype(klass))!=='System.Int32')throw Error('enum-basetype');
     const nextField=new NativeFunction(module.findExportByName('il2cpp_class_get_fields'),'pointer',['pointer','pointer'],{scheduling:'exclusive',exceptions:'propagate'});
     const fieldName=new NativeFunction(module.findExportByName('il2cpp_field_get_name'),'pointer',['pointer'],{scheduling:'exclusive',exceptions:'propagate'});
     const it=Memory.alloc(8);it.writePointer(ptr(0));const v=Memory.alloc(4);const map={};
     for(let i=0;i<4096;i++){const f=nextField(klass,it);if(f.isNull())break;if((api.field_get_flags(f)&0x8050)!==0x8050)continue;api.field_static_get_value(f,v);map[v.readS32()]=text(fieldName(f));}
     return map;
    };
    mapPoi.level=field(raid,'RaidLevel',['Holoholo.Rpc.RaidLevel']);
    mapPoi.raidTiers=enumMap(api.class_from_type(api.field_get_type(mapPoi.level)));
    const pk=classes['Holoholo.Rpc.PokemonProto'];
    if(pk){mapPoi.bossClass=pk;mapPoi.boss=field(raid,'RaidPokemon',['Holoholo.Rpc.PokemonProto']);mapPoi.bossId=field(pk,'pokemonId_',['System.Int32']);}
    mapPoi.teamMethod=method(gym,'get_GymDisplayTeam','Niantic.Holoholo.Team',[],false,null);
    mapPoi.teamNames=enumMap(api.class_from_type(api.method_get_return_type(mapPoi.teamMethod.method)));
    const gd=classes['Holoholo.Rpc.GymDisplayProto'];
    if(gd){mapPoi.gymDisplayClass=gd;mapPoi.gymDisplay=field(classes[VGP.fort],'GymDisplay',['Holoholo.Rpc.GymDisplayProto']);mapPoi.slots=field(gd,'SlotsAvailable',['System.Int32']);}
   }catch(e){mapPoi.extraError=String(e);}
  }catch(e){mapPoiError=String(e);}
  let native=null,nativeError=null;
  try{
   if(!vgp||!berries)throw Error('native-dependencies');
   const k=classes[BERRY];
   const selectBall=method(k,'SelectPokeball','System.Void',[n=>n===ITEM||n==='System.Int32'],false,null);
   const attempt=method(k,'AttemptCapture','System.Void',['Niantic.Holoholo.Encounter.PokeballThrow'],false,null);
   const run=method(k,'RunAway','System.Void',[],false,null);
   native={selectBall,attempt,run};
  }catch(e){native=null;nativeError=String(e);}

  let gymFeed=null,gymFeedError=null;
  try{
   if(!vgp||!items)throw Error('gymfeed-dependencies');
   const req=classes['Holoholo.Rpc.GymGetInfoProto'],out=classes['Holoholo.Rpc.GymGetInfoOutProto'],sd=classes['Holoholo.Rpc.GymStatusAndDefendersProto'],def=classes['Holoholo.Rpc.GymDefenderProto'],mot=classes['Holoholo.Rpc.MotivatedPokemonProto'],gym=classes['Niantic.Holoholo.Gym.MapGym'];
   if(!req||!out||!sd||!def||!mot||!gym||!classes[IBAG])throw Error('gymfeed-classes');
   const named=(owner,name,kind)=>{
    const f=api.class_get_field_from_name(owner,Memory.allocUtf8String(name));
    if(f.isNull()||!api.field_get_parent(f).equals(owner)||(api.field_get_flags(f)&0x50))throw Error('gymfeed-field:'+name);
    const t=typeName(api,api.field_get_type(f)),c=api.class_from_type(api.field_get_type(f));
    if(kind==='string'&&t!=='System.String')throw Error('gymfeed-type:'+name);
    if(kind==='double'&&t!=='System.Double')throw Error('gymfeed-type:'+name);
    if(kind==='float'&&t!=='System.Single')throw Error('gymfeed-type:'+name);
    if(kind==='uint64'&&t!=='System.UInt64')throw Error('gymfeed-type:'+name);
    if(kind==='int'&&t!=='System.Int32')throw Error('gymfeed-type:'+name);
    if(kind==='ref'&&(c.isNull()||api.class_is_valuetype(c)))throw Error('gymfeed-ref:'+name);
    if(kind==='enum'&&(c.isNull()||!api.class_is_enum(c)))throw Error('gymfeed-enum:'+name);
    return f;
   };
   const f={gymId:named(req,'GymId','string'),playerLat:named(req,'PlayerLatDegrees','double'),playerLon:named(req,'PlayerLngDegrees','double'),gymLat:named(req,'GymLatDegrees','double'),gymLon:named(req,'GymLngDegrees','double'),
    result:named(out,'Result','enum'),status:named(out,'GymStatusAndDefenders','ref'),defenders:named(sd,'GymDefender','ref'),motivated:named(def,'MotivatedPokemon','ref'),pokemon:named(mot,'Pokemon','ref'),motivation:named(mot,'MotivationNow','float'),pokemonId:named(classes[PK],'id_','uint64')};
   const list=api.class_from_type(api.field_get_type(f.defenders));
   const count=method(list,'get_Count',INT,[],false,null,true),item=method(list,'get_Item','Holoholo.Rpc.GymDefenderProto',[INT],false,null,true);
   const rpcId=enumValue(classes[VGP.method],'GymGetInfo'),success=enumValue(api.class_from_type(api.field_get_type(f.result)),'Success');
   const useItem=method(classes[IBAG],'UseItemOnGymDefender',n=>true,[n=>n===ITEM||n==='System.Int32',n=>n==='System.UInt64'||n==='System.Int64',n=>n==='System.String'],false,null);
   gymFeed={f,count,item,rpcId,success,useItem,ctor:method(req,'.ctor','System.Void',[],false,null),reqClass:req,outClass:out,statusClass:sd,defClass:def,motClass:mot,gymClass:gym};
  }catch(e){gymFeed=null;gymFeedError=String(e);}

  let research=null,researchError=null;
  try{
   if(!items||!items.lookup)throw Error('research-dependencies');
   const qs=classes['Niantic.Holoholo.Quests.IQuestService'],qr=classes['Niantic.Holoholo.Quests.IQuestRpcService'],qsc=classes['Niantic.Holoholo.Quests.QuestService'],qrc=classes['Niantic.Holoholo.Quests.QuestRpcService'],ext=classes['Niantic.Holoholo.Quests.QuestProtoExt'],qp=classes['Holoholo.Rpc.QuestProto'],qd=classes['Holoholo.Rpc.QuestDisplayProto'],rw=classes['Holoholo.Rpc.QuestRewardProto'];
   if(!qs||!qr||!qsc||!qrc||!ext||!qp||!qd||!rw)throw Error('research-classes');
   const named=(owner,name,kind)=>{
    const f=api.class_get_field_from_name(owner,Memory.allocUtf8String(name));
    if(f.isNull()||!api.field_get_parent(f).equals(owner)||(api.field_get_flags(f)&0x50))throw Error('research-field:'+name);
    const t=typeName(api,api.field_get_type(f)),c=api.class_from_type(api.field_get_type(f));
    if(kind==='string'&&t!=='System.String')throw Error('research-type:'+name);
    if(kind==='int'&&t!=='System.Int32')throw Error('research-type:'+name);
    if(kind==='ref'&&(c.isNull()||api.class_is_valuetype(c)))throw Error('research-ref:'+name);
    if(kind==='enum'&&(c.isNull()||!api.class_is_enum(c)))throw Error('research-enum:'+name);
    return f;
   };
   const f={id:named(qp,'QuestId','string'),rewards:named(qp,'QuestRewards','ref'),title:named(qd,'Title','string'),description:named(qd,'Description','string'),subquests:named(qd,'SubquestDisplays','ref'),type:named(rw,'Type','enum')};
   const rewardList=api.class_from_type(api.field_get_type(f.rewards)),subList=api.class_from_type(api.field_get_type(f.subquests));
   const m={
    quests:method(qs,'get_Quests',n=>n.includes('QuestProto')||n.includes('IEnumerable')||n.includes('List'),[],false,null),
    display:method(qs,'GetQuestDisplayProto','Holoholo.Rpc.QuestDisplayProto',['System.String'],false,null),
    complete:method(qs,'CompleteQuest','System.Void',[n=>n==='System.String',()=>true,()=>true,()=>true,()=>true,()=>true],false,null),
    remove:method(qr,'RemoveQuest','System.Void',['System.String'],false,null),
    fieldBook:method(ext,'IsFieldBookQuest','System.Boolean',['Holoholo.Rpc.QuestProto'],true,null),
    claimable:method(ext,'CanWeClaim','System.Boolean',['Holoholo.Rpc.QuestProto',n=>n.includes('QuestService')],true,null)
   };
   const rewardCount=method(rewardList,'get_Count',INT,[],false,null,true),rewardItem=method(rewardList,'get_Item','Holoholo.Rpc.QuestRewardProto',[INT],false,null,true);
   const subCount=method(subList,'get_Count',INT,[],false,null,true),subItem=method(subList,'get_Item','Holoholo.Rpc.QuestDisplayProto',[INT],false,null,true);
   // get_Quests may return a List, an interface, or an array. Resolve the
   // concrete collection first and fall back to IEnumerable/IEnumerator so a
   // different return type fails closed instead of being dereferenced blindly.
   const questsClass=api.class_from_type(api.method_get_return_type(m.quests.method));
   let listCount=null,listItem=null,enumerate=null,move=null,current=null,dispose=null;
   if(!questsClass.isNull())try{listCount=method(questsClass,'get_Count',INT,[],false,null,true);listItem=method(questsClass,'get_Item','Holoholo.Rpc.QuestProto',[INT],false,null,true);}catch(_){listCount=null;listItem=null;}
   if(!listCount||!listItem){
    try{enumerate=method(questsClass,'GetEnumerator',n=>n.includes('IEnumerator')||n.includes('Enumerator'),[],false,null,true);}catch(_){}
    if(!enumerate)try{enumerate=method(classes['System.Collections.IEnumerable'],'GetEnumerator','System.Collections.IEnumerator',[],false,null);}catch(_){}
    if(!enumerate)throw Error('research-enumerator');
    const enumerator=api.class_from_type(api.method_get_return_type(enumerate.method));
    if(enumerator.isNull())throw Error('research-enumerator-type');
    move=method(classes['System.Collections.IEnumerator'],'MoveNext',BOOL,[],false,null);
    current=method(enumerator,'get_Current',n=>n==='System.Object'||n.includes('QuestProto'),[],false,null,true);
    dispose=method(classes['System.IDisposable'],'Dispose','System.Void',[],false,null);
   }
   const getters={};
   for(const [name,kind] of [['Exp','int'],['Item','ref'],['Stardust','int'],['Candy','ref'],['PokemonEncounter','ref'],['Pokecoin','int'],['XlCandy','ref'],['MegaResource','ref']])try{getters[name]=method(rw,'get_'+name,kind==='int'?(n=>n==='System.Int32'||n==='System.Int64'):(n=>true),[],false,null);}catch(_){}
   const rewardTypes=enumMap(api.class_from_type(api.field_get_type(f.type)));
   const rf={};
   try{rf.itemItem=named(classes['Holoholo.Rpc.ItemRewardProto'],'Item','enum');rf.itemAmount=named(classes['Holoholo.Rpc.ItemRewardProto'],'Amount','int');}catch(_){}
   try{rf.candyId=named(classes['Holoholo.Rpc.PokemonCandyRewardProto'],'PokemonId','int');rf.candyAmount=named(classes['Holoholo.Rpc.PokemonCandyRewardProto'],'Amount','int');}catch(_){}
   try{rf.encDisplay=named(classes['Holoholo.Rpc.PokemonEncounterRewardProto'],'PokemonDisplay','ref');rf.displayId=named(classes[DISPLAY],'DisplayId','int');}catch(_){}
   research={f,m,rewardCount,rewardItem,subCount,subItem,getters,rewardTypes,rf,listCount,listItem,enumerate,move,current,dispose,service:null,epoch:0};
  }catch(e){research=null;researchError=String(e);}

  // Projection is optional: the activity pill still works if camera metadata differs.
  if(vgp)try{vgp.marker={camera:method(classes[VGP.camera],'get_main',VGP.camera,[],true,null),transform:method(classes['UnityEngine.Component'],'get_transform','UnityEngine.Transform',[],false,null),position:method(classes['UnityEngine.Transform'],'get_position','UnityEngine.Vector3',[],false,null),project:method(classes[VGP.camera],'WorldToScreenPoint','UnityEngine.Vector3',['UnityEngine.Vector3'],false,null),width:method(classes[VGP.screen],'get_width',INT,[],true,null),height:method(classes[VGP.screen],'get_height',INT,[],true,null)};}catch(e){vgp.markerError=String(e);}


  return{incubator,incubatorError,mapPoi,mapPoiError,vgp,vgpError,native,nativeError,gymFeed,gymFeedError,research,researchError,buddy,buddyError,gifts,giftsError,spawn,spawnError,module,api,classes,fields,fieldMeta,methods,success,caughtIdSize:caughtId.size,details,detailsError,transfer,transferError,spin,spinError,spinCamera,spinCameraError,items,itemsError,rocket,rocketError,battles,battlesError,berries,berriesError};

 }finally{if(owned&&!owned.isNull())api.thread_detach(owned);}

}

function event(s,kind,fields){if(s.queue.length>=LIMITS.queue){fault(s,Error('queue-limit'));return false;}let time=null;try{time=s.now();}catch(_){}s.queue.push(Object.assign({kind,boottimeMs:time},fields||{}));return true;}

function fault(s,error){s.allowedUntil=0;s.stopping=true;s.reason=s.reason||String(error).slice(0,180);}

function flush(s){for(const e of s.queue.splice(0)){try{console.log('[pgrazor-quick-close] '+JSON.stringify(e));}catch(_){}if(typeof s.onEvent==='function')try{s.onEvent(e);}catch(_){}}}

// Pure decision policy: no missing or malformed classification may authorize a transfer.

function transferDecision(v,protect=63){

 if(!v||![v.attack,v.defense,v.stamina].every(n=>Number.isInteger(n)&&n>=0&&n<=15))return 'unknown-iv';

 if(['rare','shiny','event','background','favorite','egg'].some(k=>typeof v[k]!=='boolean'))return 'unknown-category';

 if((protect&16)&&typeof v.xxs!=='boolean'||(protect&32)&&typeof v.xxl!=='boolean')return 'unknown-size';

 if(v.favorite||v.egg)return 'favorite-or-egg';

 if((v.attack+v.defense+v.stamina)*100>=90*45)return 'iv-at-least-90';

 for(const [key,bit]of [['rare',1],['shiny',2],['event',4],['background',8],['xxs',16],['xxl',32]])if((protect&bit)&&v[key])return 'protected-'+key;

 return null;

}

// native-policy-start
// Pure Rasiel-native helpers. Node tests slice this block by its markers.
function nativeBallChoice(mask,counts){
 if(!Number.isInteger(mask)||!counts||typeof counts!=='object')return 0;
 for(const [bit,id] of [[1,1],[2,2],[4,3]])if((mask&bit)!==0&&Number(counts[id])>0)return id;
 return 0;
}
function nativeThrowSpec(ball,curve,grade){
 const radii=[1,0.9,0.5,0.1];
 const g=Number.isInteger(grade)&&grade>=0&&grade<=3?grade:0;
 const b=Number.isInteger(ball)&&ball>0&&ball<=3?ball:1;
 return {ball:b,reticle:radii[g],grade:g,flags:(g?1:0)|(curve?256:0)};
}
function nativeThrowBytes(spec){
 // PokeballThrow is a 12-byte value type: float reticle, int item, bool nice, bool curve, padding.
 const out=new Uint8Array(12),v=new DataView(out.buffer);
 v.setFloat32(0,spec.reticle,true);v.setInt32(4,spec.ball,true);
 v.setUint8(8,(spec.flags&1)?1:0);v.setUint8(9,(spec.flags&256)?1:0);v.setUint8(10,0);
 return out;
}
function researchNormalize(value){
 return String(value==null?'':value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
}
function researchParseRules(value){
 const out=[];
 if(typeof value!=='string'||!value)return out;
 for(const raw of value.split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;
  const bar=line.indexOf('|');
  const textRaw=(bar<0?line:line.slice(0,bar)).trim();
  const rewardRaw=(bar<0?'*':line.slice(bar+1)).trim();
  const text=textRaw==='*'?'*':researchNormalize(textRaw);
  const reward=rewardRaw||'*';
  if(!text||text.length>200||reward.length>200)continue;
  out.push({text,reward});
  if(out.length>=64)break;
 }
 return out;
}
function researchRewardTokenMatches(rule,token){
 if(rule==='*')return true;
 if(typeof token!=='string'||!token||typeof rule!=='string'||!rule)return false;
 if(rule===token)return true;
 if(rule.endsWith(':?'))return token.startsWith(rule.slice(0,-1));
 return token.startsWith(rule+':');
}
function researchMatchesRule(rule,texts,tokens){
 if(!rule||typeof rule!=='object')return false;
 if(rule.text!=='*'&&(!Array.isArray(texts)||!texts.includes(rule.text)))return false;
 if(rule.reward==='*')return true;
 return Array.isArray(tokens)&&tokens.some(t=>researchRewardTokenMatches(rule.reward,t));
}
function researchShouldRemove(rules,texts,tokens){
 if(!Array.isArray(rules)||!rules.length)return false;
 if(!Array.isArray(texts)||!texts.length)return false;
 return rules.some(rule=>researchMatchesRule(rule,texts,tokens));
}
function gymBerryChoice(preferred,counts){
 const ids=[701,703,705,706,707];
 if(ids.includes(preferred)&&Number(counts&&counts[preferred])>0)return preferred;
 for(const id of ids)if(Number(counts&&counts[id])>0)return id;
 return 0;
}
// native-policy-end

function install(s,p){

 const {api,classes,fields,methods}=p;

 function exact(o,k){return !o.isNull()&&api.object_get_class(o).equals(k);}

 function hold(o){if(o.isNull())throw Error('null-managed-object');const h=api.gchandle_new(o,0);if(h.isNull())throw Error('gc-handle-new');s.ownedHandles.add(h);return h;}

 function target(h){const o=api.gchandle_get_target(h);if(o.isNull())throw Error('gc-target-null');return o;}

 function freeHandle(h){if(h&&s.ownedHandles.has(h)){api.gchandle_free(h);s.ownedHandles.delete(h);}}

 function readPtr(o,f){const out=Memory.alloc(8);out.writePointer(ptr(0));api.field_get_value(o,f,out);return out.readPointer();}

 function readS32(o,f){const out=Memory.alloc(4);out.writeS32(0);api.field_get_value(o,f,out);return out.readS32();}

 function present(o,f,size){const out=Memory.alloc(8);out.writeU64(0);api.field_get_value(o,f,out);for(let i=0;i<size;i++)if(out.add(i).readU8()!==0)return true;return false;}

 function capturedKey(o,f=fields.caughtId){const out=Memory.alloc(8);out.writeU64(0);api.field_get_value(o,f,out);return Array.from({length:8},(_,i)=>out.add(i).readU8()).join(',');}

 function invoke(m,o,args){const ex=Memory.alloc(8);ex.writePointer(ptr(0));const r=api.runtime_invoke(m,o,args||ptr(0),ex);if(!ex.readPointer().isNull())throw Error('managed-exception:'+text(api.method_get_name(m))+':'+typeName(api,api.class_get_type(api.object_get_class(ex.readPointer()))));return r;}

 function alive(o){const args=Memory.alloc(8);args.writePointer(o);const h=hold(invoke(methods.alive.method,ptr(0),args));

  try{const b=target(h);if(!exact(b,classes[BOOL]))throw Error('boxed-class');const v=api.object_unbox(b);if(v.isNull())throw Error('boxed-null');const n=v.readU8();if(n>1)throw Error('invalid-bool');return n===1;}finally{freeHandle(h);}}

 function unity(tid){return s.thread!==null&&s.matches>=3&&tid===s.thread&&!api.thread_current().isNull();}

 function releaseRecord(r){for(const k of['gui','state','response','proto','dismissed','data','pokemon','transferBag','transferPromise','vgpBag','vgpGm']){if(r[k]){try{freeHandle(r[k]);}catch(e){fault(s,e);}r[k]=null;}}}

 function findByGui(o){for(const r of s.records){if(!r.gui)continue;try{if(target(r.gui).equals(o))return r;}catch(_){}}return null;}

 function recordForGui(o,now){let r=findByGui(o);if(r)return r;

  if(s.records.length>=LIMITS.maxRecords){const i=s.records.findIndex(x=>!x.invoked);if(i<0)return null;event(s,'candidate-cancelled',{reason:'record-overflow',tid:s.thread});releaseRecord(s.records[i]);s.records.splice(i,1);}

  r={gui:hold(o),state:null,response:null,proto:null,dismissed:null,epoch:s.epoch,initDone:false,setScoresDone:false,openCompleteDone:false,success:false,capturedId:false,invoked:false,cancelled:null,readyMatch:null,createdMs:now,deadline:now+LIMITS.timeoutMs};

  s.records.push(r);return r;}

 function cancel(r,reason){if(r.cancelled)return;r.cancelled=reason;event(s,'candidate-cancelled',{reason,tid:s.thread});}

 function releasePendingDetails(){if(s.pendingDetails){freeHandle(s.pendingDetails.response);s.pendingDetails=null;}}

 function prune(now){if(s.pendingDetails&&(s.stopping||s.pendingDetails.epoch!==s.epoch||s.allowedUntil===0||now>=s.allowedUntil||now>=s.pendingDetails.deadline))releasePendingDetails();for(let i=0;i<s.records.length;){const r=s.records[i];let drop=r.cancelled||r.invoked;let reason=r.cancelled;

   if(!drop){if(r.epoch!==s.epoch){reason='permission-revoked';drop=true;}else if(s.stopping){reason='stop';drop=true;}else if(s.allowedUntil===0){reason='off';drop=true;}else if(now>=s.allowedUntil){reason='lease-expired';drop=true;}else if(now>=r.deadline){reason='timeout';drop=true;}}

   if(drop){if(reason&&!r.cancelled&&!r.invoked)event(s,'candidate-cancelled',{reason,tid:s.thread});releaseRecord(r);s.records.splice(i,1);}else i++;}}

 function cleanupTick(tid){if(s.busy)return;s.busy=true;

  try{if(!unity(tid))return;let now;try{now=s.now();}catch(e){fault(s,e);for(const r of s.records.splice(0))releaseRecord(r);if(s.openerDepth===0)for(const h of s.ownedHandles){try{freeHandle(h);}catch(e){fault(s,e);}}return;}

   giftTick(now);

   buddyTick(now);

   incubatorTick(now);

   berryTick(now);

   battleTick(now);

   rocketMiniTick(now);

   rocketTick(now);

   itemTick(now);

   mapPoiTick(now);
   vgpTick(now);
   nativeTick(now);
   gymFeedTick(now);
   researchTick(now);

   transferTick(now);

   spinTick(now,tid);

   pruneSpinCameras(now);

   prune(now);

   if(s.stopping&&s.openerDepth===0){for(const h of s.ownedHandles){try{freeHandle(h);}catch(e){fault(s,e);}}}

   if(s.stopping||s.allowedUntil===0||now>=s.allowedUntil||s.openerDepth!==0)return;

   const r=s.records.find(x=>!x.invoked&&!x.cancelled&&(x.kind==='details'?x.initDone&&x.presentDone&&x.openCompleteDone:x.initDone&&x.setScoresDone&&x.openCompleteDone&&x.success&&x.capturedId));

   if(!r)return;

   // Require a strictly later proven Unity tick than the one that first saw the

   // candidate ready, so the opener/init frame has fully unwound before invoking.

   if(r.readyMatch===null){r.readyMatch=s.matches;event(s,'candidate-armed',{tid});return;}

   if(s.matches<=r.readyMatch)return;

   if(r.kind==='details'){dismissDetails(r,tid);return;}

   const gui=target(r.gui);

   if(!exact(gui,classes[SGUI])){cancel(r,'gui-class-mismatch');return;}

   if(!alive(gui)){cancel(r,'gui-destroyed');return;}

   if(r.state){const st=target(r.state);if(!exact(st,classes[SSTATE])){cancel(r,'state-class-mismatch');return;}if(!readPtr(st,fields.dscx).equals(gui)){cancel(r,'state-gui-mismatch');return;}

    if(!readPtr(st,fields.dscy).equals(target(r.proto))||!target(r.response).equals(target(r.proto))||readS32(target(r.proto),fields.status)!==p.success||capturedKey(target(r.proto))!==r.capturedKey){cancel(r,'response-mismatch');return;}}

   const before=readS32(gui,fields.currentState);

   if(before!==STATE_OPEN){cancel(r,'state-not-open:'+before);return;}

   if(readPtr(gui,fields.onDismissed).isNull()){cancel(r,'ondismissed-null');return;}

   if(!r.dismissed||!readPtr(gui,fields.onDismissed).equals(target(r.dismissed))){cancel(r,'ondismissed-mismatch');return;}

   if(s.stopping||r.cancelled||s.allowedUntil===0||s.now()>=s.allowedUntil||r.epoch!==s.epoch||s.openerDepth!==0){cancel(r,'permission-revoked');return;}

   // Invoke the normal inherited GuiController.Dismiss once, on this Unity thread.

   // r.invoked is set first so a suppressed/throwing invoke can never run twice.

   if(p.details){releasePendingDetails();s.pendingDetails={response:hold(target(r.proto)),capturedKey:r.capturedKey,epoch:s.epoch,deadline:s.now()+LIMITS.timeoutMs,returned:false};}

   r.invoked=true;s.invoking=true;s.invokingGui=gui;let threw=null;

   try{invoke(methods.dismiss.method,gui,ptr(0));}catch(e){threw=String(e).slice(0,140);}finally{s.invoking=false;s.invokingGui=null;}

   // Verify the postcondition directly (the hook may be suppressed under nesting):

   // currentState must have advanced off 2, or the GUI must be gone.

   let after=null,gone=false;

   try{if(exact(gui,classes[SGUI])&&alive(gui))after=readS32(gui,fields.currentState);else gone=true;}catch(_){after=null;}

   if(s.pendingDetails){if(!threw&&(gone||(after!==null&&after!==STATE_OPEN)))s.pendingDetails.returned=true;else releasePendingDetails();}

   event(s,'summary-dismiss-invoked',{tid,stateBefore:before,stateAfter:after,guiGone:gone,error:threw,advanced:gone||(after!==null&&after!==STATE_OPEN)});

   releaseRecord(r);const idx=s.records.indexOf(r);if(idx>=0)s.records.splice(idx,1);

  }catch(e){fault(s,e);}finally{s.busy=false;}}

 // ---- opener/initialization hooks: observe completion, never re-enter dismissal ----

 let windowStart=s.now(),hits=0;

 function openHook(address,handler){s.listeners.push(Interceptor.attach(address,{

  onEnter(args){s.openerDepth++;this.active=true;this.payload=null;

   try{if(!s.active||s.stopping||!unity(this.threadId)||s.allowedUntil===0||s.now()>=s.allowedUntil)return;

    const now=s.now();if(now-windowStart>=1000){windowStart=now;hits=0;}if(++hits>LIMITS.hitsPerSecond)throw Error('hook-rate-limit');

    this.epoch=s.epoch;this.payload=handler.onEnter?handler.onEnter(args,this.threadId):{};

   }catch(e){fault(s,e);}},

  onLeave(){if(this.active){s.openerDepth--;this.active=false;}const payload=this.payload;this.payload=null;if(!payload)return;

   const wasBusy=s.busy;s.busy=true;try{if(!s.stopping&&this.epoch===s.epoch&&s.allowedUntil!==0&&s.now()<s.allowedUntil&&unity(this.threadId))handler.onLeave(payload,this.threadId);}catch(e){fault(s,e);}finally{try{handler.release&&handler.release(payload);}catch(e){fault(s,e);}s.busy=wasBusy;}}}));}

 // SummaryState.Initialize(response): both Initialize and (its internal) SetScores

 // have returned at leave; capture state/response identity and confirmed success.

 openHook(methods.initialize.address,{

  onEnter(args){for(const r of s.records)cancel(r,'new-initialization');

   const state=exact(args[0],classes[SSTATE])?hold(args[0]):null;if(!state)return null;

   try{const proto=!args[1].isNull()&&exact(args[1],classes[RESP])?hold(args[1]):null;return{state,proto};}catch(e){freeHandle(state);throw e;}},

  onLeave(payload,tid){const state=target(payload.state);

   const success=payload.proto?readS32(target(payload.proto),fields.status)===p.success:false;

   if(!success){event(s,'candidate-skipped',{reason:'not-confirmed-success',tid});return;}

   const gui=readPtr(state,fields.dscx);if(!exact(gui,classes[SGUI])){event(s,'candidate-skipped',{reason:'no-summary-gui',tid});return;}

   const now=s.now(),r=recordForGui(gui,now);if(!r)return;

   if(r.cancelled)return;

   if(r.state)freeHandle(r.state);r.state=payload.state;payload.state=null;

   if(payload.proto){if(r.proto)freeHandle(r.proto);r.proto=payload.proto;payload.proto=null;}

   const response=readPtr(state,fields.dscy),responseMatched=exact(response,classes[RESP])&&response.equals(target(r.proto));

   // SetScores owns r.response; never replace its evidence with Initialize's argument.

   if(!responseMatched||(r.response&&!target(r.response).equals(target(r.proto)))){cancel(r,'response-mismatch');return;}

   const dismissed=readPtr(gui,fields.onDismissed);if(!dismissed.isNull())r.dismissed=hold(dismissed);

   const capturedId=present(target(r.proto),fields.caughtId,p.caughtIdSize);

   r.initDone=true;r.success=true;r.capturedId=capturedId;r.capturedKey=capturedKey(target(r.proto));r.readyMatch=null;

   event(s,'candidate-initialized',{tid,capturedId,responseMatched});},

  release(payload){freeHandle(payload.state);freeHandle(payload.proto);}});

 // SummaryGui.SetScores(response,berry): XP/token fields are now populated.

 openHook(methods.setScores.address,{

  onEnter(args){if(!exact(args[0],classes[SGUI])||!exact(args[1],classes[RESP]))return null;const gui=hold(args[0]);try{return{gui,response:hold(args[1])};}catch(e){freeHandle(gui);throw e;}},

  onLeave(payload,tid){const now=s.now(),r=recordForGui(target(payload.gui),now);if(!r||r.cancelled)return;

   if(r.response)freeHandle(r.response);r.response=payload.response;payload.response=null;

   if(r.proto&&!target(r.proto).equals(target(r.response))){cancel(r,'response-mismatch');return;}

   r.setScoresDone=true;r.readyMatch=null;event(s,'candidate-progress',{stage:'set-scores',tid});},

  release(payload){freeHandle(payload.gui);freeHandle(payload.response);}});

 // SummaryGui.HandleOpenComplete(): the opener wrote currentState=2 and tail-called

 // this; its return means the open transition finished for this GUI.

 openHook(methods.handleOpenComplete.address,{

  onEnter(args){return exact(args[0],classes[SGUI])?{gui:hold(args[0])}:null;},

  onLeave(payload,tid){const now=s.now(),r=recordForGui(target(payload.gui),now);if(!r)return;r.openCompleteDone=true;r.readyMatch=null;event(s,'candidate-progress',{stage:'open-complete',tid});},

  release(payload){freeHandle(payload.gui);}});

 // GuiController.Dismiss(): detect a natural/user dismissal of a tracked summary and

 // cancel our queued auto-close. Our own invoke is identified and ignored here.

 s.listeners.push(Interceptor.attach(methods.dismiss.address,{onEnter(args){

  try{if(!s.active)return;if(s.invoking&&s.invokingGui&&args[0].equals(s.invokingGui))return;if(!unity(this.threadId))return;

   const r=findByGui(args[0]);if(r&&!r.invoked&&!r.cancelled)cancel(r,'user-dismiss');

  }catch(e){fault(s,e);}}}));

 // State exit revokes queued work before the game starts teardown.

 s.listeners.push(Interceptor.attach(methods.exitState.address,{onEnter(args){try{

  if(!s.active||!unity(this.threadId))return;

  for(const r of s.records)if(r.state&&target(r.state).equals(args[0]))cancel(r,'state-exit');

 }catch(e){fault(s,e);}}}));

 // Details are tracked only while the encounter's own buji builds its screen.

 // Inventory Initialize calls cannot create candidates. The normal click handler

 // preserves special encounter return handling and all GUI/service cleanup.

 const detailFrames=[];

 function detailsValid(r){const d=p.details,f=d.fields;

  const gui=target(r.gui),st=target(r.state),response=target(r.response),data=target(r.data),pokemon=target(r.pokemon);

  if(!exact(gui,classes[DGUI])||!exact(st,classes[VIEW])||!exact(response,classes[RESP])||!exact(data,classes[DATA])||!exact(pokemon,classes[PK]))return false;

  if(!readPtr(st,f.viewResponse).equals(response)||readS32(response,fields.status)!==p.success||capturedKey(response)!==r.capturedKey||capturedKey(pokemon,f.id)!==r.capturedKey)return false;

  if(!exact(target(r.dismissed),classes[ACTION])||!readPtr(target(r.dismissed),f.delegateTarget).equals(st))return false;

  if(!readPtr(gui,f.data).equals(data)||!readPtr(gui,f.callback).equals(target(r.dismissed))||!readPtr(data,f.onDismissed).equals(target(r.dismissed)))return false;

  const flag=Memory.alloc(1);api.field_get_value(data,f.post,flag);if(flag.readU8()!==1||readS32(data,f.index)!==0)return false;

  const list=readPtr(data,f.list);if(!exact(list,d.listClass))return false;

  let count=null,item=null;

  try{count=hold(invoke(d.methods.count.method,list));const boxed=target(count);if(!exact(boxed,classes[INT])||api.object_unbox(boxed).readS32()!==1)return false;

   const index=Memory.alloc(4);index.writeS32(0);const args=Memory.alloc(8);args.writePointer(index);

   item=hold(invoke(d.methods.item.method,list,args));return target(item).equals(pokemon);

  }finally{freeHandle(count);freeHandle(item);}

 }

 // An existing species can build details synchronously inside our summary Dismiss.

 // Those nested hooks are suppressed. The later real open-complete callback can

 // recover ONLY the screen carrying the retained successful response, exact view

 // delegate and captured Pokemon. No inventory or unrelated GUI is eligible.

 function recoverDetails(gui){const pending=s.pendingDetails,d=p.details;

  if(!pending||!pending.returned||s.invoking||pending.epoch!==s.epoch||s.now()>=pending.deadline||!exact(gui,classes[DGUI]))return null;

  const f=d.fields,data=readPtr(gui,f.data);if(!exact(data,classes[DATA]))return null;

  const cb=readPtr(data,f.onDismissed);if(!exact(cb,classes[ACTION])||!readPtr(gui,f.callback).equals(cb))return null;

  const state=readPtr(cb,f.delegateTarget);if(!exact(state,classes[VIEW]))return null;

  const response=readPtr(state,f.viewResponse);if(!response.equals(target(pending.response))||readS32(response,fields.status)!==p.success||capturedKey(response)!==pending.capturedKey)return null;

  const list=readPtr(data,f.list);if(!exact(list,d.listClass)||readS32(data,f.index)!==0)return null;

  const r={kind:'details',epoch:s.epoch,deadline:pending.deadline,readyMatch:null,initDone:true,presentDone:true,openCompleteDone:false,invoked:false,cancelled:null,capturedKey:pending.capturedKey};

  s.records.push(r);r.gui=hold(gui);r.data=hold(data);r.dismissed=hold(cb);r.state=hold(state);r.response=hold(response);

  const index=Memory.alloc(4);index.writeS32(0);const args=Memory.alloc(8);args.writePointer(index);r.pokemon=hold(invoke(d.methods.item.method,list,args));

  if(!detailsValid(r)){cancel(r,'recovered-details-identity-mismatch');return null;}

  releasePendingDetails();event(s,'details-recovered-after-summary',{tid:s.thread});return r;

 }

 function finishTransfer(key,success,reason){const pending=s.transferPending.get(key);if(!pending)return;

  s.transferPending.delete(key);pending.record.transferComplete=success;pending.record.transferFailed=!success;

  freeHandle(pending.bag);freeHandle(pending.pokemon);

  event(s,success?'transfer-confirmed':'transfer-error',{capturedKey:key,reason:reason||null,tid:s.thread});

 }

 function transferTick(now){for(const[key,x]of s.transferPending){

  if(s.stopping||x.epoch!==s.epoch||!s.transferEnabled||now>=s.allowedUntil){freeHandle(x.bag);freeHandle(x.pokemon);s.transferPending.delete(key);}

  else if(now>=x.deadline)finishTransfer(key,false,'response-timeout');

 }}

 if(p.transfer){const t=p.transfer;

  function matchTransfer(args){if(!unity(this.threadId)||s.stopping||!s.transferEnabled||s.now()>=s.allowedUntil||!exact(args[0],t.callbackClass))return null;

   const pk=readPtr(args[0],t.fields.callbackPokemon);if(!exact(pk,classes[PK]))return null;

   const key=capturedKey(pk,p.details.fields.id),x=s.transferPending.get(key);

   if(!x||x.epoch!==s.epoch||!target(x.pokemon).equals(pk)||!readPtr(args[0],t.fields.callbackBag).equals(target(x.bag)))return null;

   return key;

  }

  s.listeners.push(Interceptor.attach(t.methods.result.address,{onEnter(args){try{this.key=matchTransfer.call(this,args);

   this.success=this.key!==null&&exact(args[1],classes[RELEASE])&&readS32(args[1],t.fields.resultStatus)===t.resultSuccess;

  }catch(e){this.key=null;}},onLeave(){if(this.key!==null&&this.key!==undefined)finishTransfer(this.key,this.success,this.success?null:'server-result');}}));

  s.listeners.push(Interceptor.attach(t.methods.error.address,{onEnter(args){try{this.key=matchTransfer.call(this,args);}catch(e){this.key=null;}},onLeave(){if(this.key!==null&&this.key!==undefined)finishTransfer(this.key,false,'service-error');}}));

 }

 // Each camera iterator caches 1/animationTime in djjv on its first MoveNext.

 // Shorten only that fresh iterator: shared camera defaults, FOV and callbacks

 // remain untouched. Native final-position/OnComplete still execute normally.

 const spinCameras=new Map();

 function pruneSpinCameras(now){for(const [phase,r]of spinCameras)if(!spinPermitted()||r.epoch!==s.spinEpoch||now>=r.deadline){freeHandle(r.state);spinCameras.delete(phase);}}

 if(p.spinCamera){const c=p.spinCamera;

  for(const def of c.states){

   s.listeners.push(Interceptor.attach(def.enter.address,{onEnter(args){try{if(!unity(this.threadId)||!spinPermitted()||!exact(args[0],def.klass))return;const old=spinCameras.get(def.phase);if(old)freeHandle(old.state);spinCameras.set(def.phase,{state:hold(args[0]),def,epoch:s.spinEpoch,deadline:s.now()+15000});}catch(e){event(s,'spin-camera-error',{reason:String(e)});}}}));

   s.listeners.push(Interceptor.attach(def.exit.address,{onEnter(args){try{const r=spinCameras.get(def.phase);if(unity(this.threadId)&&r&&target(r.state).equals(args[0])){freeHandle(r.state);spinCameras.delete(def.phase);}}catch(_){}}}));

  }

  s.listeners.push(Interceptor.attach(c.move.address,{

   onEnter(args){try{if(!unity(this.threadId)||!spinPermitted()||!exact(args[0],c.iterator)||readS32(args[0],c.state)!==0)return;pruneSpinCameras(s.now());const camera=readPtr(args[0],c.owner);if(!exact(camera,classes[SPLINE]))return;

    for(const r of spinCameras.values())if(readPtr(target(r.state),r.def.camera).equals(camera)){this.cameraIterator=hold(args[0]);this.cameraEpoch=s.spinEpoch;this.cameraPhase=r.def.phase;break;}

   }catch(e){event(s,'spin-camera-error',{reason:String(e)});}},

   onLeave(ret){if(!this.cameraIterator)return;try{if(!spinPermitted()||this.cameraEpoch!==s.spinEpoch||ret.toInt32()!==1)return;const o=target(this.cameraIterator);if(readS32(o,c.state)!==1)return;const speed=o.add(0x50).readFloat();if(!Number.isFinite(speed)||speed<=0)return;o.add(0x50).writeFloat(Math.max(speed,25));event(s,'spin-camera-fast',{phase:this.cameraPhase,originalMs:1000/speed,targetMs:Math.min(1000/speed,40)});}catch(e){event(s,'spin-camera-error',{reason:String(e)});}finally{freeHandle(this.cameraIterator);}}

  }));

 }

 // Rocket scope is observed even while toggles are off, so enabling mid-battle works.

 const rocketState={state:null,ui:null,vui:null,charges:[],shield:null,shieldUsed:false,next:0,failed:false,gate:null,lastFast:0};

 function rocketDrop(key){freeHandle(rocketState[key]);rocketState[key]=null;}

 function rocketClear(){rocketMiniRestore();for(const h of rocketState.charges)freeHandle(h);rocketState.charges=[];for(const k of ['state','ui','vui','shield'])rocketDrop(k);rocketState.shieldUsed=false;rocketState.failed=false;rocketState.next=0;rocketState.gate=null;rocketState.lastFast=0;}

 function rocketBool(m,o,args){const h=hold(invoke(m.method,o,args));try{const b=target(h);if(!exact(b,classes[BOOL]))throw Error('rocket-bool');return api.object_unbox(b).readU8()===1;}finally{freeHandle(h);}}

 function rocketGate(reason){if(rocketState.gate!==reason){rocketState.gate=reason;event(s,'rocket-attack-gate',{reason});}}

 function rocketTick(now){

  if(!p.rocket)return;if(s.stopping){rocketClear();return;}

  const r=rocketState,t=p.rocket,m=t.methods,f=t.fields;

  if(r.failed||!r.state||!(s.rocketMask>0)||!(now<s.rocketLease)||now<r.next)return;

  try{

   if(!exact(target(r.state),classes[ROCKET])){rocketClear();return;}

   if(r.shield){const gui=target(r.shield);if(!alive(gui)||readS32(gui,fields.currentState)===3){rocketDrop('shield');}

    else if((s.rocketMask&4)&&!r.shieldUsed&&readS32(gui,fields.currentState)===STATE_OPEN&&readS32(gui,f.shields)>0){

     const button=readPtr(gui,f.button);if(!button.isNull()&&alive(button)&&rocketBool(m.interactable,button)){r.shieldUsed=true;r.next=now+250;invoke(m.shield.method,gui);event(s,'rocket-action',{action:'shield'});return;}

    }

   }

   if(r.vui&&t.vnext){rocketVNextTick(now);return;}

   if(!r.ui){rocketGate('waiting-for-battle-ui');return;}const gui=target(r.ui);if(!alive(gui)){rocketDrop('ui');return;}

   // CombatUI uses its own ShowUI/HideUI lifecycle. GuiController open state is not an attack-availability contract.

   const dh=hold(invoke(m.director.method,gui));try{const dir=target(dh);if(!exact(dir,classes[RDIR])){rocketGate('director:'+typeName(api,api.class_get_type(api.object_get_class(dir))));return;}if(!rocketBool(m.active,dir)){rocketGate('battle-not-active');return;}rocketGate('active');

    if(s.rocketMask&2){for(const field of [f.first,f.second]){const charge=readPtr(gui,field);if(!exact(charge,classes[RCHARGE])||!alive(charge))continue;

     if(present(charge,f.charged,1)&&present(charge,f.input,1)&&rocketBool(m.visible,charge)){r.next=now+500;invoke(m.charge.method,charge);event(s,'rocket-action',{action:'charged'});return;}

    }}

    if(s.rocketMask&1){r.next=now+150;const result=invoke(m.fast.method,dir);if(now-r.lastFast>5000){r.lastFast=now;event(s,'rocket-action',{action:'quick',accepted:!result.isNull()});}}

   }finally{freeHandle(dh);}

  }catch(e){r.failed=true;event(s,'rocket-error',{reason:String(e)});}

 }

 // Collect actual spawned targets using the normal particle-trigger path; never write score or shorten the timer.

 let rocketMini=null;

 function miniSet(m,o,values){const data=Memory.alloc(Math.max(4,values.length*4));if(values.length===1)data.writeU8(values[0]?1:0);else values.forEach((v,i)=>data.add(i*4).writeFloat(v));const args=Memory.alloc(8);args.writePointer(data);invoke(m.method,o,args);}

 function rocketMiniRestore(){const r=rocketMini;if(!r)return;rocketMini=null;try{const m=p.rocket.mini.methods,transform=target(r.transform),go=target(r.go);if(alive(transform))miniSet(m.setScale,transform,r.scale);if(alive(go))miniSet(m.setActive,go,[r.active]);}catch(e){event(s,'rocket-minigame-error',{reason:String(e)});}finally{for(const h of [r.challenge,r.transform,r.go])freeHandle(h);}}

 function rocketMiniAllowed(){return !!(p.rocket&&p.rocket.mini&&rocketState.state&&!rocketState.failed&&!s.stopping&&(s.rocketMask&2)&&s.now()<s.rocketLease);}

 function rocketMiniTick(now){if(rocketMini&&(!rocketMiniAllowed()||!alive(target(rocketMini.challenge))))rocketMiniRestore();}

 function rocketMiniCollect(challenge){if(!rocketMiniAllowed())return;const t=p.rocket.mini,m=t.methods;

  if(!exact(challenge,classes[RMINI])||!alive(challenge)||!present(challenge,t.fields.running,1))return;

  if(rocketMini&&!target(rocketMini.challenge).equals(challenge))rocketMiniRestore();

  if(!rocketMini){const collider=readPtr(challenge,t.fields.collider);if(collider.isNull()||!alive(collider))return;

   const hs=[];try{const ch=hold(challenge);hs.push(ch);const th=hold(invoke(m.transform.method,collider));hs.push(th);const gh=hold(invoke(m.gameObject.method,collider));hs.push(gh);const sh=hold(invoke(m.scale.method,target(th)));hs.push(sh);

    const value=api.object_unbox(target(sh)),scale=[0,4,8].map(o=>value.add(o).readFloat());if(!scale.every(v=>Number.isFinite(v)&&Math.abs(v)<10000))throw Error('minigame-scale');const active=rocketBool(m.active,target(gh));

    rocketMini={challenge:ch,transform:th,go:gh,scale,active};freeHandle(sh);event(s,'rocket-minigame',{active:true,mode:'particle-collector'});

   }catch(e){for(const h of hs)freeHandle(h);throw e;}

  }

  miniSet(m.setScale,target(rocketMini.transform),rocketMini.scale.map(v=>Math.max(Math.abs(v),1)*1000));miniSet(m.setActive,target(rocketMini.go),[true]);

 }

 function rocketVNextTick(now){const r=rocketState,t=p.rocket.vnext,m=t.methods,f=t.fields,gui=target(r.vui);

  if(!alive(gui)){rocketDrop('vui');return;}

  if(rocketBool(m.blocked,gui)){rocketGate('vnext-input-blocked');return;}

  if(s.rocketMask&2){for(const h of r.charges){const c=target(h);if(!alive(c)||!rocketBool(m.charged,c)||!rocketBool(m.visible,c))continue;

   const button=readPtr(c,f.button);if(button.isNull()||!alive(button)||!rocketBool(p.rocket.methods.interactable,button))continue;

   r.next=now+600;invoke(m.charge.method,c);event(s,'rocket-action',{action:'charged',path:'vnext'});return;

  }}

  const gesture=readPtr(gui,f.gesture);if(!exact(gesture,classes[RVGEST])||!alive(gesture)||!present(gesture,f.enabled,1)){rocketGate('vnext-fast-input-disabled');return;}

  rocketGate('vnext-active');if(s.rocketMask&1){const tap=readPtr(gesture,f.tap);if(tap.isNull())return;const args=Memory.alloc(8);args.writePointer(tap);r.next=now+150;invoke(m.fast.method,gesture,args);if(now-r.lastFast>5000){r.lastFast=now;event(s,'rocket-action',{action:'quick',path:'vnext'});}}

 }

 if(p.rocket){const m=p.rocket.methods;

  function observe(method,enter,leave){s.listeners.push(Interceptor.attach(method.address,{onEnter(args){if(!unity(this.threadId)||s.stopping)return;try{this.rocketCall=enter.call(this,args);}catch(e){rocketState.failed=true;event(s,'rocket-error',{reason:String(e)});}},onLeave(){if(this.rocketCall&&leave)try{leave.call(this);}catch(e){rocketState.failed=true;event(s,'rocket-error',{reason:String(e)});}}}));}

  if(p.rocket.mini){const mm=p.rocket.mini.methods;

   observe(mm.update,function(a){if(!rocketMiniAllowed()){rocketMiniRestore();return;}if(!exact(a[0],classes[RMINI]))return;this.miniChallenge=hold(a[0]);return true;},function(){try{rocketMiniCollect(target(this.miniChallenge));}finally{freeHandle(this.miniChallenge);}});

   for(const method of [mm.exit,mm.hide,mm.destroy])observe(method,function(a){if(rocketMini&&target(rocketMini.challenge).equals(a[0]))rocketMiniRestore();});

  }

  if(p.rocket.vnext){const vm=p.rocket.vnext.methods;

   observe(vm.update,function(a){if(!rocketState.state||!exact(a[0],classes[RVUI]))return;if(!rocketState.vui||!target(rocketState.vui).equals(a[0])){rocketDrop('vui');rocketState.vui=hold(a[0]);event(s,'rocket-ui',{source:'vnext-update'});}});

   observe(vm.close,function(a){if(rocketState.vui&&target(rocketState.vui).equals(a[0])){rocketDrop('vui');for(const h of rocketState.charges)freeHandle(h);rocketState.charges=[];}});

   observe(vm.observe,function(a){if(!rocketState.state||!exact(a[0],classes[RVCHARGE]))return;const list=rocketState.charges;for(let i=list.length-1;i>=0;i--)if(!alive(target(list[i]))){freeHandle(list[i]);list.splice(i,1);}if(!list.some(h=>target(h).equals(a[0]))&&list.length<4)list.push(hold(a[0]));});

  }

  observe(m.enter,function(a){rocketClear();if(exact(a[0],classes[ROCKET])){rocketState.state=hold(a[0]);return true;}},function(){event(s,'rocket-scope',{active:true});});

  observe(m.exit,function(a){if(rocketState.state&&target(rocketState.state).equals(a[0])){rocketClear();event(s,'rocket-scope',{active:false});}});

  observe(m.ui,function(a){if(rocketState.state&&exact(a[0],classes[RUI])){rocketDrop('ui');this.rocketUi=hold(a[0]);return true;}},function(){rocketDrop('ui');rocketState.ui=this.rocketUi;});

  observe(m.update,function(a){if(!rocketState.state||!exact(a[0],classes[RUI]))return;if(!rocketState.ui||!target(rocketState.ui).equals(a[0])){rocketDrop('ui');rocketState.ui=hold(a[0]);event(s,'rocket-ui',{source:'live-update'});}});

  observe(m.close,function(a){if(rocketState.ui&&target(rocketState.ui).equals(a[0]))rocketDrop('ui');});

  observe(m.prompt,function(a){if(!rocketState.state||!exact(a[0],classes[RSHIELD]))return;rocketDrop('shield');rocketState.shieldUsed=false;if(a[1].toInt32()!==0)rocketState.shield=hold(a[0]);});

  observe(m.shield,function(a){if(rocketState.shield&&target(rocketState.shield).equals(a[0]))rocketState.shieldUsed=true;});

  observe(m.shieldClose,function(a){if(rocketState.shield&&target(rocketState.shield).equals(a[0]))rocketDrop('shield');});

 }


 // Auto incubation: only the permanent unlimited item, confirmed through inventory.
 const incubatorState={next:0,pending:null,blocked:false,enabled:false,status:''};
 function incubationStatus(message){if(message!==incubatorState.status){incubatorState.status=message;event(s,'incubator-status',{message});}}
 function incubationClear(){const q=incubatorState.pending;if(q)for(const h of q.handles)freeHandle(h);incubatorState.pending=null;}
 function incubationScalar(o,f,kind){const v=Memory.alloc(8);v.writeU64(0);api.field_get_value(o,f,v);return kind==='double'?v.readDouble():kind==='bool'?v.readU8()!==0:v.readU64().toString();}
 function incubationString(o){if(o.isNull())return '';const n=api.string_length(o);if(n<0||n>256)throw Error('incubator-string');return n?api.string_chars(o).readUtf16String(n):'';}
 function incubationVirtual(m,o){const v=api.object_get_virtual_method(o,m.method);if(v.isNull())throw Error('incubator-interface');return invoke(v,o);}
 function incubationEach(collection,limit,visit){const m=p.incubator.m,h=hold(collection);let eh=null;
  try{const e=incubationVirtual(m.enumerate,collection);eh=hold(e);for(let i=0;i<=limit;i++){const box=incubationVirtual(m.move,target(eh));if(box.isNull())throw Error('incubator-enumerator');if(!api.object_unbox(box).readU8())return;if(i===limit)throw Error('incubator-inventory-limit');const value=incubationVirtual(m.current,target(eh)),vh=hold(value);try{visit(target(vh));}finally{freeHandle(vh);}}}
  finally{if(eh){try{incubationVirtual(m.dispose,target(eh));}finally{freeHandle(eh);}}freeHandle(h);}
 }
 function incubatorTick(now){const t=p.incubator,r=incubatorState;if(!t)return;
  if(s.stopping){incubationClear();return;}
  if(!s.incubatorEnabled){r.enabled=false;incubationStatus('Off');return;}
  if(!r.enabled){r.enabled=true;if(!r.pending)r.blocked=false;r.next=0;}
  if(!(now<s.incubatorLease)){incubationStatus('Waiting for the map');return;}
  if(now<r.next)return;r.next=now+5000;
  const roots=[],keep=o=>{const h=hold(o);roots.push(h);return o;},f=t.f,m=t.m;
  try{
   const l=p.items.lookup,map=invoke(l.find.method,ptr(0),itemArgs([l.typeObject(api.class_get_type(l.map))]));if(map.isNull())return;keep(map);
   const container=keep(invoke(l.container.method,map));
   const resolve=(contract,concrete)=>{const o=keep(invoke(l.resolve.method,container,itemArgs([l.typeObject(api.class_get_type(classes[contract]))])));if(!exact(o,classes[concrete]))throw Error('incubator-service-type');return o;};
   const player=resolve(VGP.playerContract,VGP.player);let free=null,seen=false,matched=false;
   incubationEach(invoke(m.incubators.method,player),128,o=>{
    if(!exact(o,classes[t.inc]))throw Error('incubator-proto');
    const item=readS32(o,f.item),id=incubationString(readPtr(o,f.incId)),assigned=incubationScalar(o,f.pokemonId);
    if(r.pending&&id===r.pending.incubator){seen=true;if(assigned!=='0'){matched=true;const ours=assigned===r.pending.egg;incubationClear();r.blocked=false;incubationStatus(ours?'Egg incubating':'Incubator already in use');}}
    if(!free&&item===t.unlimited&&id&&assigned==='0'&&incubationScalar(o,f.expiry)==='0')free={o:keep(o),id};
   });
   if(matched)return;
   if(r.pending){if(now>=r.pending.deadline){r.blocked=true;incubationStatus('Assignment unconfirmed; waiting for inventory');}else incubationStatus('Confirming egg assignment');return;}
   if(r.blocked){incubationStatus('Incubation stopped; toggle off/on to retry');return;}
   if(!free){incubationStatus('Unlimited incubator in use or unavailable');return;}
   const bag=resolve(VGP.bagContract,BAG);let choice=null;
   incubationEach(invoke(m.eggs.method,bag),25000,o=>{
    if(!exact(o,classes[PK]))throw Error('incubator-egg-proto');
    if(!incubationScalar(o,f.egg,'bool')||readS32(o,f.eggType)===t.special||incubationString(readPtr(o,f.assignment)))return;
    const id=incubationScalar(o,f.id),km=incubationScalar(o,f.target,'double')-incubationScalar(o,f.start,'double');
    if(id==='0'||!Number.isFinite(km)||km<=0||km>100)return;
    if(!choice||(s.incubatorLongest?km>choice.km:km<choice.km)){if(choice)freeHandle(choice.h);choice={h:hold(o),id,km};roots.push(choice.h);}
   });
   if(!choice){incubationStatus('No eggs waiting');r.next=now+15000;return;}
   // Recheck both assignment fields immediately before the single service call.
   if(!s.incubatorEnabled||!(s.now()<s.incubatorLease)||incubationScalar(free.o,f.pokemonId)!=='0'||incubationString(readPtr(target(choice.h),f.assignment)))return;
   const service=resolve(t.contract,t.service),idArg=Memory.alloc(8);idArg.writeU64(uint64(choice.id));
   const q={egg:choice.id,incubator:free.id,deadline:now+30000,handles:[hold(target(choice.h)),hold(free.o),hold(service)]};r.pending=q;
   incubationStatus('Starting '+choice.km+' km egg');
   const promise=invoke(m.put.method,service,itemArgs([idArg,free.o]));if(!promise.isNull())q.handles.push(hold(promise));
   event(s,'incubator-request',{distance:choice.km,priority:s.incubatorLongest?'longest':'shortest'});
  }catch(e){r.blocked=true;incubationStatus(r.pending?'Assignment unconfirmed; waiting for inventory':'Incubation unavailable; toggle off/on to retry');event(s,'incubator-error',{reason:String(e).slice(0,180)});}
  finally{for(const h of roots)freeHandle(h);}
 }
 event(s,'incubator-ready',{available:!!p.incubator,reason:p.incubatorError});

 // Buddy feeding uses the normal service and never enters the play/food UI.

 const buddyState={service:null,pending:null,id:'',config:0,next:0,blocked:false,feeds:0,progress:null,status:''};

 function buddyStatus(message){if(buddyState.status!==message){buddyState.status=message;event(s,'buddy-status',{message});}}

 function buddyFloat(m,o){const h=hold(invoke(m.method,ptr(0),itemArgs([o])));try{return api.object_unbox(target(h)).readFloat();}finally{freeHandle(h);}}

 function buddyClearPending(){const r=buddyState.pending;if(!r)return;freeHandle(r.rpc);freeHandle(r.promise);buddyState.pending=null;}

 function buddyTick(now){const t=p.buddy,r=buddyState;if(!t)return;

  if(s.stopping){buddyClearPending();freeHandle(r.service);r.service=null;return;}

  if(r.pending){const q=r.pending;if(q.result!==null){const ok=q.result===t.success;buddyClearPending();r.next=now+5000;itemState.next=0;if(!ok){r.blocked=true;buddyStatus('Buddy feed failed (result '+q.result+'); toggle Off to retry');}else{r.feeds++;r.progress={before:q.fullness,deadline:now+15000};buddyStatus('Berry fed; checking buddy hunger');}return;}

   if(now>q.deadline&&!r.blocked){r.blocked=true;buddyStatus('Buddy feed timed out; no automatic retry');}return;}

  if(r.config!==s.buddyBerry){r.config=s.buddyBerry;r.blocked=false;r.feeds=0;r.progress=null;r.next=0;}

  if(!s.buddyBerry){buddyStatus('Off');return;}if(!(now<s.buddyLease)){buddyStatus('Waiting for the map');return;}if(now<r.next)return;r.next=now+5000;

  const roots=[];const root=o=>{roots.push(hold(o));return o;};

  try{const l=p.items.lookup,m=t.methods,f=t.fields;

   if(!r.service||!alive(target(r.service))){freeHandle(r.service);r.service=null;const map=invoke(l.find.method,ptr(0),itemArgs([l.typeObject(api.class_get_type(l.map))]));if(map.isNull())return;root(map);const container=root(invoke(l.container.method,map));const service=invoke(l.resolve.method,container,itemArgs([l.typeObject(api.class_get_type(t.contract))]));if(!exact(service,classes[BUDDY_TYPES[7769]]))throw Error('buddy-stats-service');r.service=hold(service);event(s,'buddy-service-ready');}

   const service=target(r.service),pokemon=readPtr(service,f.pokemon),rpc=readPtr(service,f.rpc);if(!exact(pokemon,classes[BUDDY_TYPES[8109]])||!exact(rpc,classes[BUDDY_TYPES[7768]]))throw Error('buddy-service-type');

   if(!rocketBool(m.has,pokemon)){buddyStatus('Choose a buddy first');return;}

   const proto=root(invoke(m.pokemon.method,pokemon));if(!exact(proto,classes['Holoholo.Rpc.BuddyPokemonProto']))return;const key=capturedKey(proto,f.buddyId);if(!key||key==='0,0,0,0,0,0,0,0')return;

   if(key!==r.id){r.id=key;r.feeds=0;r.progress=null;r.blocked=false;}

   const stats=root(invoke(m.stats.method,service));if(!exact(stats,classes['Holoholo.Rpc.BuddyObservedData'])){buddyStatus('Waiting for buddy hunger data');return;}

   const remaining=buddyFloat(m.remaining,stats),fullness=buddyFloat(m.fullness,stats);if(!Number.isFinite(remaining)||!Number.isFinite(fullness))throw Error('buddy-hunger-invalid');

   if(remaining>0){r.feeds=0;r.progress=null;r.blocked=false;buddyStatus('Buddy fed - '+Math.ceil(remaining/60)+' min remaining');return;}

   // A paused request must still observe a later fed state and re-arm for the next hunger cycle.
   if(r.blocked)return;
   if(r.progress){if(fullness>r.progress.before+0.001)r.progress=null;else if(now<r.progress.deadline)return;else{r.blocked=true;buddyStatus('Hunger did not update; toggle Off to retry');return;}}

   if(rocketBool(m.cooldown,ptr(0),itemArgs([stats]))||fullness>=0.999){buddyStatus('Waiting for buddy feeding cooldown');return;}

   if(r.feeds>=6){r.blocked=true;buddyStatus('Feeding paused after six berries; check your buddy');return;}

   const bag=readPtr(rpc,f.bag);if(!exact(bag,classes[IBAG]))throw Error('buddy-item-bag');const count=itemInt(p.items.methods.quantity,bag,itemArgs([itemNumber(s.buddyBerry)]));if(count<1){buddyStatus('Selected berry is out of stock');return;}

   const q={rpc:hold(rpc),promise:null,result:null,fullness,deadline:now+30000};r.pending=q;

   buddyStatus('Feeding buddy');let promise;buddyState.invoking=true;try{promise=invoke(m.feed.method,rpc,itemArgs([itemNumber(s.buddyBerry),itemNumber(1)]));}finally{buddyState.invoking=false;}if(!promise.isNull())q.promise=hold(promise);event(s,'buddy-feed-request',{berry:s.buddyBerry,count:1});

  }catch(e){r.blocked=true;buddyStatus('Buddy feeding paused: '+String(e));event(s,'buddy-error',{reason:String(e)});}finally{for(const h of roots)freeHandle(h);}

 }

 event(s,'buddy-ready',{available:!!p.buddy,reason:p.buddyError});

 if(p.buddy){const t=p.buddy;s.listeners.push(Interceptor.attach(t.methods.result.address,{onEnter(a){this.q=null;try{const q=buddyState.pending;if(!unity(this.threadId)||!q||q.ambiguous||!exact(a[0],t.callback)||!readPtr(a[0],t.fields.callbackRpc).equals(target(q.rpc))||!exact(a[1],classes['Holoholo.Rpc.BuddyFeedingOutProto']))return;this.q=q;this.result=readS32(a[1],t.fields.result);}catch(_){}},onLeave(){if(this.q&&buddyState.pending===this.q)this.q.result=this.result;}}));

  s.listeners.push(Interceptor.attach(t.methods.feed.address,{onEnter(){if(unity(this.threadId)&&!buddyState.invoking){if(buddyState.pending){buddyState.pending.ambiguous=true;buddyState.blocked=true;}buddyState.next=s.now()+30000;buddyState.feeds=0;buddyState.progress=null;}}}));

 }

 // Gifts are scoped to the friend profile or incoming gift dialog the user opens.

 const incomingGift={gui:null,attempted:false,automated:false,deadline:0,next:0,wait:null};

 function incomingClear(){freeHandle(incomingGift.gui);Object.assign(incomingGift,{gui:null,attempted:false,automated:false,deadline:0,next:0,wait:null});}

 function incomingWait(reason){if(incomingGift.wait!==reason){incomingGift.wait=reason;event(s,'gift-wait',{reason,mask:s.giftMask||0});}}

 function incomingTick(now){const r=incomingGift,t=p.gifts;if(!t||!r.gui)return;

  try{const gui=target(r.gui);if(s.stopping||now>r.deadline||!alive(gui)){incomingClear();return;}

   if(r.attempted||now<r.next)return;r.next=now+100;

   if(!(s.giftMask&1)){incomingWait('Auto open is off');return;}if(!(now<s.giftLease)){incomingWait('Waiting for foreground readiness');return;}

   if(!giftOpen(r.gui)){incomingWait('Waiting for dialog to finish opening');return;}

   const details=readPtr(gui,t.fields.openDetails);if(!exact(details,classes['Holoholo.Rpc.GiftBoxDetailsProto'])||!giftText(readPtr(details,t.fields.sender))){incomingWait('Waiting for incoming gift details');return;}

   if(!giftButton(gui,t.fields.openButton)){incomingWait('Waiting for Open button');return;}

   r.attempted=true;r.automated=true;giftState.opened=true;giftState.checked=true;

   invoke(t.methods.open.method,gui);giftStatus('Opening gift');

  }catch(e){r.attempted=true;event(s,'gift-error',{reason:String(e)});}

 }

 const giftState={profile:null,open:null,send:null,list:null,sheet:null,giftWidgets:[],stickerWidgets:[],id:'',opened:false,checked:false,sent:false,chosen:false,stickerStarted:false,stickerClicked:false,phase:'idle',next:0,deadline:0,failed:false};

 function giftDrop(key){freeHandle(giftState[key]);giftState[key]=null;}

 function giftChildren(){giftSendRestore();for(const k of ['open','send','list','sheet','firstGift'])giftDrop(k);for(const w of giftState.giftWidgets){freeHandle(w.h);freeHandle(w.proto);}for(const h of giftState.stickerWidgets)freeHandle(h);giftState.giftWidgets=[];giftState.stickerWidgets=[];}

 function giftSendRestore(){const r=giftState.fastSend;if(!r)return;giftState.fastSend=null;try{const gui=target(r.gui);if(alive(gui))for(const [off,value] of r.values)gui.add(off).writeFloat(value);}finally{freeHandle(r.gui);}}

 function giftSendFast(gui){giftSendRestore();const values=p.gifts.sendDelays.map(off=>[off,gui.add(off).readFloat()]);if(values.some(v=>!Number.isFinite(v[1])))throw Error('gift-delay-invalid');giftState.fastSend={gui:hold(gui),values};for(const [off] of values)gui.add(off).writeFloat(0);}

 function giftReset(){giftChildren();giftDrop('profile');Object.assign(giftState,{id:'',opened:false,checked:false,sent:false,confirmed:false,listExiting:false,chosen:false,stickerStarted:false,stickerClicked:false,phase:'idle',next:0,deadline:0,failed:false});}

 function giftText(o){if(o.isNull())return '';const n=api.string_length(o);if(n<1||n>256)return '';return api.string_chars(o).readUtf16String(n);}

 function giftId(friend){if(!exact(friend,classes['Niantic.Platform.Internal.Protos.FriendDetailsProto']))return '';const player=readPtr(friend,p.gifts.fields.player);if(!exact(player,classes['Niantic.Platform.Internal.Protos.PlayerSummaryProto']))return '';return giftText(readPtr(player,p.gifts.fields.playerId));}

 function giftOpen(h){if(!h)return false;const o=target(h);return alive(o)&&readS32(o,fields.currentState)===STATE_OPEN;}

 function giftButton(o,f){const b=readPtr(o,f);return !b.isNull()&&alive(b)&&rocketBool(p.gifts.methods.active,b)&&rocketBool(p.gifts.methods.interactable,b);}

 function giftStatus(message){event(s,'gift-status',{message});}

 // A bundled send outlives the profile UI until the service completes it.

 let bundledGift=null;

 function giftVirtual(m,o,args){const concrete=api.object_get_virtual_method(o,m.method);if(concrete.isNull())throw Error('gift-virtual-method');return invoke(concrete,o,args);}

 function bundledClear(){const r=bundledGift;if(!r)return;bundledGift=null;

  try{if(r.reserved)invoke(p.gifts.methods.returnSticker.method,target(r.stickerService),itemArgs([target(r.stickerId),itemNumber(1)]));}catch(e){event(s,'gift-error',{reason:'sticker-release:'+e});}

  finally{for(const h of r.roots)freeHandle(h);}

 }

 function bundledQueue(panel){const f=p.gifts.fields,r={roots:[],issued:false,finished:false,result:null,reserved:false,deadline:s.now()+30000};

  const keep=o=>{const h=hold(o);r.roots.push(h);return h;};

  try{const data=readPtr(panel,f.data),friend=readPtr(data,f.panelFriend),id=giftId(friend);if(!id)throw Error('gift-recipient-missing');

   r.id=id;r.panel=keep(panel);r.friend=keep(friend);bundledGift=r;giftStatus('Preparing gift');

  }catch(e){for(const h of r.roots)freeHandle(h);throw e;}

 }

 function bundledTick(now){const r=bundledGift,t=p.gifts;if(!r)return;

  if(s.stopping){bundledClear();return;}

  if(r.issued){if(r.finished){giftStatus(r.result===t.sendSuccess?'Gift sent':r.result===null?'Gift send failed; no automatic retry':'Gift send failed (result '+r.result+')');event(s,'gift-bundled-result',{success:r.result===t.sendSuccess,result:r.result});bundledClear();}

   else if(now>r.deadline&&!r.timedOut){r.timedOut=true;giftStatus('Gift result pending; no automatic retry');}return;}

  if(!(s.giftMask&2)||!(now<s.giftLease)){bundledClear();return;}

  const m=t.methods,f=t.fields,keep=o=>{const h=hold(o);r.roots.push(h);return h;};

  try{const panel=target(r.panel),friend=target(r.friend);if(!alive(panel)||!giftState.profile||!invoke(m.panel.method,target(giftState.profile)).equals(panel)||giftId(readPtr(readPtr(panel,f.data),f.panelFriend))!==r.id){bundledClear();return;}

   if(!giftButton(panel,f.chooseButton)||present(panel,f.checkPending,1)||readS32(panel,f.checkResult)!==t.checkSuccess){giftStatus('Gift sending is not available for this friend yet');bundledClear();return;}

   const service=readPtr(panel,f.panelGifting),rpc=readPtr(panel,f.panelRpc);if(!exact(service,classes[GIFT_TYPES[6154]])||!exact(rpc,classes[GIFT_TYPES[6149]]))throw Error('gift-service-type');r.rpc=keep(rpc);

   const gifts=invoke(m.sendable.method,service);if(gifts.isNull())throw Error('gift-inventory-missing');keep(gifts);

   const enumerator=giftVirtual(m.getEnumerator,gifts);if(enumerator.isNull())throw Error('gift-enumerator-missing');keep(enumerator);let gift=null;

   try{const moved=giftVirtual(m.moveGift,enumerator);if(moved.isNull())throw Error('gift-enumerator-result');if(api.object_unbox(moved).readU8())gift=giftVirtual(m.currentGift,enumerator);if(gift&&!gift.isNull())keep(gift);}finally{giftVirtual(m.disposeGift,enumerator);}

   if(!gift||gift.isNull()){giftStatus('No gifts available');bundledClear();return;}if(!exact(gift,classes['Holoholo.Rpc.GiftBoxProto']))throw Error('gift-inventory-entry');

   const giftIdValue=Memory.alloc(8);api.field_get_value(gift,f.giftId,giftIdValue);if(giftIdValue.readU64().toString()==='0')throw Error('gift-id-zero');

   const player=readPtr(friend,f.player),playerId=readPtr(player,f.playerId),niaService=readPtr(panel,f.niaUtil);if(niaService.isNull())throw Error('gift-nia-service');

   const niaId=giftVirtual(m.niaId,niaService,itemArgs([player]));if(!giftText(niaId))throw Error('gift-nia-id');keep(niaId);

   let sticker=ptr(0);if(s.giftMask&4){const stock=readPtr(rpc,f.rpcStickers);if(!exact(stock,classes[GIFT_TYPES[6164]]))throw Error('gift-sticker-service');r.stickerService=keep(stock);

    const inventory=invoke(m.inventory.method,stock,itemArgs([itemNumber(0)]));if(!exact(inventory,t.stickerListClass))throw Error('sticker-inventory-type');keep(inventory);const count=itemInt(m.stickerCount,inventory);if(count<0||count>4096)throw Error('sticker-inventory-size');

    for(let i=0;i<count;i++){const candidate=invoke(m.stickerItem.method,inventory,itemArgs([itemNumber(i)]));if(!exact(candidate,classes['Holoholo.Rpc.StickerProto'])||itemInt(m.quantity,stock,itemArgs([candidate]))<=0)continue;

     sticker=candidate;keep(sticker);const stickerId=readPtr(sticker,f.stickerId);if(!giftText(stickerId))throw Error('gift-sticker-id');r.stickerId=keep(stickerId);invoke(m.reserve.method,stock,itemArgs([stickerId,itemNumber(1)]));r.reserved=true;break;}

   }

   // Do not override stamp errors or retry rejected requests silently.

   r.issued=true;r.deadline=now+30000;giftStatus('Sending gift');event(s,'gift-bundled-request',{sticker:!sticker.isNull()});

   const promise=invoke(m.rpcSend.method,rpc,itemArgs([giftIdValue,playerId,niaId,sticker,itemNumber(0)]));if(!promise.isNull())keep(promise);

  }catch(e){event(s,'gift-error',{reason:'bundled-send:'+e});if(r.issued){r.timedOut=true;giftStatus('Gift result uncertain; no automatic retry');}else bundledClear();}

 }

 function giftTick(now){const r=giftState,t=p.gifts;if(!t)return;bundledTick(now);incomingTick(now);if(s.stopping){incomingClear();giftReset();return;}

  if(!r.profile)return;if(!(now<s.giftLease)||!(s.giftMask&3)){if(r.phase!=='idle'){r.failed=true;giftChildren();}return;}if(r.failed||now<r.next)return;r.next=now+150;

  try{const m=t.methods,f=t.fields,profile=target(r.profile);if(!alive(profile)){giftReset();return;}

   const panel=invoke(m.panel.method,profile);if(!exact(panel,classes[GIFT_TYPES[5936]])||!alive(panel))return;

   const panelRoot=hold(panel);try{

    const data=readPtr(panel,f.data);if(data.isNull())return;const id=giftId(readPtr(data,f.panelFriend));if(!id)return;

    if(id!==r.id){if(r.id)giftChildren();Object.assign(r,{id,opened:false,checked:false,sent:false,confirmed:false,listExiting:false,chosen:false,stickerStarted:false,stickerClicked:false,phase:'idle',deadline:0});r.next=now+600;return;}

    if(r.deadline&&now>r.deadline){r.failed=true;giftChildren();giftStatus('Gift flow paused; finish manually or reopen this friend');return;}

    if(giftOpen(incomingGift.gui)||giftOpen(r.open))return;

    if(giftOpen(r.send)){

     if(!(s.giftMask&2)||r.sent)return;const gui=target(r.send);if(giftId(readPtr(gui,f.sendFriend))!==id){r.failed=true;return;}

     if((s.giftMask&4)&&!r.stickerStarted){

      r.stickerStarted=true;const selected=readPtr(gui,f.sendSticker);

      if(selected.isNull()){

       const service=readPtr(gui,f.stickerService);if(!exact(service,classes[GIFT_TYPES[6164]]))throw Error('sticker-service-type');

       // withEmptyStickers=false; recheck reservations before selecting an owned sticker.

       const inventory=invoke(m.inventory.method,service,itemArgs([itemNumber(0)]));if(!exact(inventory,t.stickerListClass))throw Error('sticker-inventory-type');

       const inventoryRoot=hold(inventory);try{const count=itemInt(m.stickerCount,inventory);if(count<0||count>4096)throw Error('sticker-inventory-size');

        for(let i=0;i<count;i++){const sticker=invoke(m.stickerItem.method,inventory,itemArgs([itemNumber(i)]));if(!exact(sticker,classes['Holoholo.Rpc.StickerProto'])||itemInt(m.quantity,service,itemArgs([sticker]))<=0)continue;

         const stickerRoot=hold(sticker);try{invoke(m.selectSticker.method,gui,itemArgs([sticker]));if(!readPtr(gui,f.sendSticker).equals(sticker))throw Error('sticker-selection-failed');r.stickerClicked=true;giftStatus('Added owned sticker');}finally{freeHandle(stickerRoot);}break;

        }

       }finally{freeHandle(inventoryRoot);}

      }

     }

     if(giftOpen(r.sheet))return;

     if(giftButton(gui,f.sendButton)){r.sent=true;r.phase='sent';r.deadline=now+30000;giftSendFast(gui);invoke(m.send.method,gui);giftStatus('Sending gift');}return;

    }

    if(giftOpen(r.list)){

     if(!(s.giftMask&2)||r.listExiting)return;

     const listGui=target(r.list);if(present(listGui,f.listSurprise,1))return;const rows=readPtr(listGui,f.rows);if(!exact(rows,t.rowsClass))return;const count=itemInt(m.rowCount,rows);

     if(r.confirmed||count===0){r.listExiting=true;r.phase='done';r.sent=true;r.deadline=0;invoke(m.listExit.method,listGui);giftStatus(r.confirmed?'Gift sent':'No gifts remaining');return;}

     if(r.chosen)return;

     if(!r.firstGift){const row=invoke(m.rowItem.method,rows,itemArgs([itemNumber(0)]));if(exact(row,classes[GIFT_TYPES[6211]])){const rowRoot=hold(row);try{const first=invoke(m.giftBox.method,row,itemArgs([itemNumber(0)]));if(exact(first,classes['Holoholo.Rpc.GiftBoxDetailsProto']))r.firstGift=hold(first);}finally{freeHandle(rowRoot);}}}

     if(!r.firstGift)return;const selected=readPtr(target(r.list),f.selected);if(!exact(selected,t.selectedClass))return;

     const callbackRoot=hold(selected);try{r.chosen=true;r.phase='selected';r.deadline=now+15000;invoke(m.selectFirst.method,selected,itemArgs([target(r.firstGift)]));giftStatus('Selected first inventory gift');}finally{freeHandle(callbackRoot);}return;

    }

    // Do not start another flow while a gift screen is still closing or loading.

    if(r.phase==='opening'||r.phase==='list'||r.phase==='selected'||r.phase==='sticker')return;

    if(!giftOpen(r.profile)||rocketBool(m.disabled,profile))return;

    if((s.giftMask&1)&&!r.checked){r.checked=true;r.next=now+1200;if(rocketBool(m.check,panel)){r.phase='opening';r.deadline=now+30000;r.next=now+500;}return;}

    // Sending is armed only by the player's OnGiftClick; visiting a profile never sends.

    r.deadline=0;

   }finally{freeHandle(panelRoot);}

  }catch(e){r.failed=true;giftChildren();event(s,'gift-error',{reason:String(e)});}

 }

 event(s,'gift-ready',{available:!!p.gifts,reason:p.giftsError});

 if(p.gifts){const m=p.gifts.methods,f=p.gifts.fields;

  function giftObserve(method,fn,after=false){s.listeners.push(Interceptor.attach(method.address,{onEnter(a){this.roots=[];this.args=null;if(!unity(this.threadId)||s.stopping)return;try{if(after){this.args=[a[0],a[1],a[2]];this.roots.push(hold(a[0]));if(method===m.giftUpdate&&!a[2].isNull())this.roots.push(hold(a[2]));}else fn(a);}catch(e){giftState.failed=true;event(s,'gift-error',{reason:String(e)});}},onLeave(){try{if(this.args&&!s.stopping)fn(this.args);}catch(e){giftState.failed=true;event(s,'gift-error',{reason:String(e)});}finally{for(const h of this.roots)freeHandle(h);}}}));}

  giftObserve(m.sequence,a=>{const r=incomingGift;if(!r.gui||!r.automated||!(s.giftMask&1)||!(s.now()<s.giftLease)||!exact(a[0],classes[GIFT_OPEN_SEQUENCE]))return;const gui=readPtr(a[0],f.sequenceGui),response=readPtr(a[0],f.sequenceResponse);if(!gui.equals(target(r.gui))||!exact(response,classes['Holoholo.Rpc.OpenGiftOutProto'])||readS32(response,f.openResult)!==p.gifts.openSuccess||readS32(a[0],f.sequenceState)!==0)return;

   // Exact-build state 3 retains friendship callback + normal Dismiss after successful response.

   // States 0..2 are gift animation, reward display preparation and reward presentation.

   a[0].add(0x10).writeS32(3);event(s,'gift-presentation-skipped',{kindOfGift:'received'});

  });

  const sendOriginal=new NativeFunction(m.choose.address,'void',['pointer','pointer'],{scheduling:'exclusive',exceptions:'propagate'});

  const sendReplacement=new NativeCallback(function(panel,info){

   if(!unity(Process.getCurrentThreadId())||s.stopping||!s.ready)return sendOriginal(panel,info);

   if(bundledGift){giftStatus('Gift send already pending');return;}

   if(!(s.giftMask&2)||!(s.now()<s.giftLease))return sendOriginal(panel,info);

   try{const r=giftState;if(!r.profile||!exact(panel,classes[GIFT_TYPES[5936]]))return sendOriginal(panel,info);const profile=target(r.profile);

    if(!alive(profile)||!invoke(m.panel.method,profile).equals(panel)||rocketBool(m.disabled,profile)||!giftButton(panel,f.chooseButton))return;

    bundledQueue(panel);

   }catch(e){event(s,'gift-error',{reason:'bundled-trigger:'+e});}

  },'void',['pointer','pointer']);

  Interceptor.replace(m.choose.address,sendReplacement);s.listeners.push({detach(){Interceptor.revert(m.choose.address);}});s.giftSendReplacement={original:sendOriginal,replacement:sendReplacement};

  function ownedCallback(o){const r=bundledGift;return r&&r.issued&&r.rpc&&exact(o,p.gifts.callbackClass)&&readPtr(o,f.callbackService).equals(target(r.rpc))&&giftText(readPtr(o,f.callbackId))===r.id;}

  giftObserve(m.rpcResult,a=>{if(ownedCallback(a[0])&&exact(a[1],classes['Holoholo.Rpc.SendGiftOutProto']))bundledGift.result=readS32(a[1],f.sendResult);});

  giftObserve(m.rpcFinally,a=>{if(ownedCallback(a[0]))bundledGift.finished=true;},true);

  giftObserve(m.profileOpen,a=>{giftReset();giftState.profile=hold(a[0]);giftState.next=s.now()+200;},true);

  giftObserve(m.profileClose,a=>{if(giftState.profile&&target(giftState.profile).equals(a[0]))giftReset();});

  giftObserve(m.openReady,a=>{if(!exact(a[0],classes[GIFT_TYPES[6240]]))return;incomingClear();incomingGift.gui=hold(a[0]);incomingGift.deadline=s.now()+30000;incomingGift.next=s.now()+100;if(giftState.profile){giftDrop('open');giftState.open=hold(a[0]);}event(s,'gift-dialog',{source:'incoming',profilePresent:!!giftState.profile});},true);

  giftObserve(m.open,a=>{if(incomingGift.gui&&target(incomingGift.gui).equals(a[0]))incomingGift.attempted=true;});

  giftObserve(m.openClose,a=>{if(incomingGift.gui&&target(incomingGift.gui).equals(a[0]))incomingClear();if(giftState.open&&target(giftState.open).equals(a[0]))giftDrop('open');giftState.checked=true;giftState.phase='idle';giftState.deadline=0;giftState.next=s.now()+600;});

  for(const [key,ready,close,owner] of [['send',m.sendReady,m.sendClose,6258],['sheet',m.sheetReady,m.sheetClose,6195]]){

   giftObserve(ready,a=>{const r=giftState;if(!r.profile||!exact(a[0],classes[GIFT_TYPES[owner]]))return;if(key==='send'&&r.phase!=='selected')return;if(key==='sheet'&&!r.stickerStarted)return;giftDrop(key);r[key]=hold(a[0]);},true);

   giftObserve(close,a=>{const r=giftState;if(r[key]&&target(r[key]).equals(a[0])){if(key==='send')giftSendRestore();giftDrop(key);r.next=s.now()+150;if(key==='open'){r.checked=true;r.phase='idle';r.deadline=0;}if(key==='send'){r.phase='done';r.deadline=0;}}});

  }

  giftObserve(m.listInit,a=>{if(giftState.profile&&giftState.phase==='list'&&!a[1].isNull()&&!present(a[1],f.surprise,1)){giftDrop('list');giftDrop('firstGift');giftState.list=hold(a[0]);const list=readPtr(a[1],f.listItems);if(exact(list,p.gifts.listClass)&&itemInt(m.listCount,list)>0){const first=invoke(m.listItem.method,list,itemArgs([itemNumber(0)]));if(exact(first,classes['Holoholo.Rpc.GiftBoxDetailsProto']))giftState.firstGift=hold(first);}event(s,'gift-list',{firstAvailable:!!giftState.firstGift,deleteIcons:present(a[1],f.deleteMode,1)});}});

  giftObserve(m.listReady,a=>{const r=giftState;if(!r.profile||!['list','selected','sent','done'].includes(r.phase)||present(a[0],f.listSurprise,1))return;giftDrop('list');r.list=hold(a[0]);r.listExiting=false;r.next=s.now()+100;event(s,'gift-list-ready',{phase:r.phase});},true);

  giftObserve(m.sendResult,a=>{const r=giftState;if(!r.sent||!r.send||!target(r.send).equals(a[0])||!exact(a[1],classes['Holoholo.Rpc.SendGiftOutProto']))return;r.confirmed=readS32(a[1],f.sendResult)===p.gifts.sendSuccess;event(s,'gift-send-result',{success:r.confirmed});});

  giftObserve(m.listClose,a=>{if(giftState.list&&target(giftState.list).equals(a[0])){giftDrop('list');if(!giftState.chosen&&!giftState.listExiting)giftState.failed=true;}});

  giftObserve(m.giftUpdate,a=>{const r=giftState,index=a[1].toInt32();if(!r.profile||r.phase!=='list'||index<0||index>1||!exact(a[2],classes['Holoholo.Rpc.GiftBoxDetailsProto']))return;const old=r.giftWidgets.findIndex(w=>target(w.h).equals(a[0])&&w.index===index);if(old>=0){freeHandle(r.giftWidgets[old].h);freeHandle(r.giftWidgets[old].proto);r.giftWidgets.splice(old,1);}if(r.giftWidgets.length<32)r.giftWidgets.push({h:hold(a[0]),index,proto:hold(a[2])});},true);

  giftObserve(m.stickerInit,a=>{const r=giftState;if(r.profile&&r.stickerStarted&&r.stickerWidgets.length<256&&!r.stickerWidgets.some(h=>target(h).equals(a[0])))r.stickerWidgets.push(hold(a[0]));},true);

 }

 // Non-Rocket battle automation: separate scope, settings and roots.

 const berryState={scope:null,pending:null,failed:false,pulse:0};

 function berryOverlay(active,busy=false){event(s,'encounter-berry',{active,busy});}

 function berryReleasePending(){const q=berryState.pending;if(!q)return;berryState.pending=null;freeHandle(q.ball);freeHandle(q.callback);}

 function berryClear(){berryReleasePending();freeHandle(berryState.scope);Object.assign(berryState,{scope:null,pending:null,failed:false,pulse:0});berryOverlay(false);}

 function berryResume(){const q=berryState.pending;if(!q)return;berryState.pending=null;

  try{const ball=target(q.ball);if(alive(ball)&&berryState.scope){s.berrySubmitOriginal(ball,q.first,q.second,q.info);}}

  finally{freeHandle(q.ball);freeHandle(q.callback);berryOverlay(!!berryState.scope);}

 }

 function berryTick(now){const t=p.berries,r=berryState;if(!t)return;if(s.berryImpactReady&&s.installBerryImpact&&!s.stopping){const install=s.installBerryImpact;s.installBerryImpact=null;install();event(s,'berry-impact-ready');}

  if(s.stopping){berryResume();berryClear();return;}if(!r.scope)return;

  const scope=target(r.scope);if(!alive(scope)){berryClear();return;}

  if(now>=r.pulse){r.pulse=now+500;const ui=readPtr(scope,t.fields.ui);berryOverlay(!ui.isNull()&&alive(ui)&&readS32(ui,fields.currentState)===STATE_OPEN,!!r.pending);}

  const q=r.pending;if(!q)return;

  if(q.done){itemState.next=0;berryResume();return;}

  if(now>q.deadline){r.failed=true;event(s,'berry-error',{reason:'Berry response timed out; submitting catch without retry'});berryResume();return;}

  if(q.started)return;

  if(!(now<s.berryLease)){berryResume();return;}

  try{q.stage='ball checks';const ball=target(q.ball);if(!alive(ball)||rocketBool(t.methods.bread,ball)){berryResume();return;}

   q.stage='encounter checks';if(!rocketBool(t.methods.can,scope)||rocketBool(t.methods.photo,scope)){berryResume();return;}

   q.stage='ball type';const typeRoot=hold(invoke(t.methods.ballType.method,ball));let ballType;try{ballType=api.object_unbox(target(typeRoot)).readS32();}finally{freeHandle(typeRoot);}if(ballType===4){berryResume();return;}

   q.stage='inventory';const bag=readPtr(scope,t.fields.bag);if(!exact(bag,classes[IBAG])||itemInt(p.items.methods.quantity,bag,itemArgs([itemNumber(q.id)]))<=0){berryResume();return;}

   q.stage='create callback';const callback=api.object_new(t.callback);q.callback=hold(callback);api.field_set_value_object(callback,t.fields.callbackScope,scope);api.field_set_value(callback,t.fields.callbackBerry,itemNumber(q.id));if(!readPtr(callback,t.fields.callbackScope).equals(scope)||readS32(callback,t.fields.callbackBerry)!==q.id)throw Error('berry-callback-field-readback');

   q.stage='request';q.started=true;invoke(t.methods.direct.method,callback,itemArgs([itemNumber(1)]));event(s,'berry-feed-requested',{id:q.id,source:'impact'});

  }catch(e){r.failed=true;event(s,'berry-error',{reason:String(e),stage:q.stage});berryResume();}

 }

 // SPAWN replacement: preserve the original double ABI and all game settings when disabled.

 if(p.spawn){try{

  const address=p.spawn.address;

  const original=new NativeFunction(address,'double',['pointer','pointer'],{scheduling:'exclusive',exceptions:'propagate'});

  const replacement=new NativeCallback(function(self,info){

   const radius=original(self,info);

   try{const now=s.now();if(s.active&&s.ready&&!s.stopping&&s.spawnEnabled&&now<s.spawnLease&&Number.isFinite(radius)&&radius>0){

    const effective=Math.max(radius,80);

    if(!s.spawnSampleAt||now-s.spawnSampleAt>=2000){s.spawnSampleAt=now;event(s,'spawn-range',{original:radius,effective});}

    return effective;

   }}catch(_){}

   return radius;

  },'double',['pointer','pointer']);

  Interceptor.replace(address,replacement);

  s.listeners.push({detach(){Interceptor.revert(address);}});

  s.spawnReplacement={original,replacement};



 }catch(e){p.spawn=null;p.spawnError=String(e);}}

 event(s,'spawn-ready',{available:!!p.spawn,reason:p.spawnError});

 event(s,'berry-ready',{available:!!p.berries,reason:p.berriesError});

 if(p.berries){const t=p.berries;

  s.listeners.push(Interceptor.attach(t.methods.enter.address,{onEnter(a){if(!unity(this.threadId)||s.stopping)return;berryClear();if(exact(a[0],classes[BERRY])){berryState.scope=hold(a[0]);berryOverlay(true);}}}));

  s.listeners.push(Interceptor.attach(t.methods.exit.address,{onEnter(a){if(unity(this.threadId)&&berryState.scope&&target(berryState.scope).equals(a[0])){berryClear();event(s,'cooldown-encounter',{source:''});}}}));

  s.installBerryImpact=()=>{

  // PokeballThrow is a 12-byte non-HFA value: x1 carries its first8 bytes,

  // x2 carries the remaining4. Keep the exact packed words, including throw modifiers.

  const submit=new NativeFunction(t.methods.submit.address,'void',['pointer','pointer','pointer','pointer'],{scheduling:'exclusive',exceptions:'propagate'}),peek=new NativeFunction(t.methods.peek.address,'pointer',['pointer','pointer'],{scheduling:'exclusive',exceptions:'propagate'});

  s.berrySubmitOriginal=submit;

  const replacement=new NativeCallback(function(ball,first,second,info){const r=berryState;
   if(unity(Process.getCurrentThreadId())&&!s.stopping&&!r.pending)event(s,'cooldown-action',{action:((second.toUInt32()>>>16)&255)!==0?'Ball drop':'Ball throw'});

   if(!unity(Process.getCurrentThreadId())||s.stopping||!r.scope||r.failed||!s.berryId||!(s.now()<s.berryLease))return submit(ball,first,second,info);

   if(r.pending){if(target(r.pending.ball).equals(ball))return;return submit(ball,first,second,info);}

   try{if(!exact(ball,classes['Niantic.Holoholo.Encounter.Pokeball'])||((second.toUInt32()>>>16)&255)!==0||first.toUInt32()===4)return submit(ball,first,second,info);

    r.pending={ball:hold(ball),callback:null,first,second,info,id:s.berryId,started:false,done:false,deadline:s.now()+8000};berryOverlay(true,true);event(s,'berry-impact-queued',{id:s.berryId});

   }catch(e){event(s,'berry-error',{reason:String(e),stage:'impact'});return submit(ball,first,second,info);}

  },'void',['pointer','pointer','pointer','pointer']);

  // The normal result getter returns null while its catch promise is pending.

  // Preserve that behavior while berry use delays creation of the new promise;

  // otherwise a prior throw's completed promise could be observed again.

  const peekReplacement=new NativeCallback(function(ball,info){const q=berryState.pending;if(q&&target(q.ball).equals(ball))return ptr(0);return peek(ball,info);},'pointer',['pointer','pointer']);

  Interceptor.replace(t.methods.submit.address,replacement);s.listeners.push({detach(){Interceptor.revert(t.methods.submit.address);}});

  Interceptor.replace(t.methods.peek.address,peekReplacement);s.listeners.push({detach(){Interceptor.revert(t.methods.peek.address);}});s.berryThrowCallbacks={replacement,peekReplacement};

  };

  for(const name of ['result','error'])s.listeners.push(Interceptor.attach(t.methods[name].address,{onEnter(a){if(name==='result'&&unity(this.threadId)&&!a[1].isNull()&&a[1].add(0x10).readS32()===0)event(s,'cooldown-action',{action:'Berry feeding'});const q=berryState.pending;this.q=q&&q.callback&&target(q.callback).equals(a[0])?q:null;},onLeave(){if(this.q&&berryState.pending===this.q)this.q.done=true;}}));

 }

 const battleState={scope:null,mode:-1,gesture:null,legacy:false,charges:[],maxMoves:[],next:0,dodgeUntil:0,dodgeNext:0,failed:false,lastLog:0};

 function battleDropGesture(){freeHandle(battleState.gesture);battleState.gesture=null;battleState.dodgeUntil=0;}

 function battleClear(){battleDropGesture();freeHandle(battleState.scope);for(const list of [battleState.charges,battleState.maxMoves])for(const h of list)freeHandle(h);Object.assign(battleState,{scope:null,mode:-1,charges:[],maxMoves:[],next:0,dodgeUntil:0,dodgeNext:0,failed:false});}

 function battleDodgeCue(mode){const r=battleState,now=s.now();if(r.scope&&r.mode===mode&&!r.failed&&now<s.battleLease&&(s.battleMask&(128<<mode))&&now>=r.dodgeNext&&!r.dodgeUntil){r.dodgeUntil=now+450;event(s,'battle-dodge-cue',{mode});}}

 function battleCapture(list,o){for(let i=list.length-1;i>=0;i--)if(!alive(target(list[i]))){freeHandle(list[i]);list.splice(i,1);}if(!list.some(h=>target(h).equals(o))&&list.length<8)list.push(hold(o));}

 function battleTick(now){if(!p.battles)return;const r=battleState,t=p.battles,m=t.methods;

  if(s.stopping){battleClear();return;}if(!(now<s.battleLease)||!(s.battleMask&(128<<r.mode))||now>r.dodgeUntil)r.dodgeUntil=0;if(!r.scope||r.failed||!(now<s.battleLease)||rocketState.state)return;

  const mask=(s.battleMask>> (r.mode*2))&(r.mode===2?7:3);

  try{

   // A battle scope survives the victory/results animation. Require live Active status

   // before any attack/button/dodge call; UI active/enabled alone is insufficient.

   if(!r.legacy){if(!r.gesture)return;const g=target(r.gesture);if(!alive(g)||!rocketBool(m.active,g))return;const director=readPtr(g,t.fields.director);if(director.isNull())return;

    const h=hold(invoke(m.currentState.method,director));let status;try{const state=target(h);if(!exact(state,classes[BATTLE_TYPES[44226]]))return;status=readS32(state,t.fields.battleStatus);}finally{freeHandle(h);}

    if(status!==t.statusActive){r.dodgeUntil=0;if(status!==t.statusUnset){event(s,'battle-ended',{mode:r.mode,status});battleClear();}return;}

   }

   if(r.dodgeUntil&&r.gesture){const g=target(r.gesture);if(alive(g)&&rocketBool(m.active,g)&&(r.legacy||present(g,p.rocket.vnext.fields.enabled,1))){

    const args=Memory.alloc(16),direction=Memory.alloc(4);direction.writeS32(t.dodgeLeft);

    if(r.legacy){const flick=readPtr(g,t.fields.legacyFlick);if(flick.isNull())return;args.writePointer(flick);args.add(8).writePointer(ptr(0));}else args.writePointer(direction);

    r.dodgeUntil=0;r.dodgeNext=now+700;r.next=now+500;invoke((r.legacy?m.legacyDodge:m.dodge).method,g,args);event(s,'battle-action',{mode:r.mode,action:'dodge'});return;

   }return;}

   if(now<r.next||!mask)return;

   if(r.mode===2&&(mask&4)){for(const h of r.maxMoves){const o=target(h);if(!alive(o)||readS32(o,t.fields.maxType)!==t.maxAttack)continue;const b=readPtr(o,t.fields.maxButton);

    if(!b.isNull()&&alive(b)&&rocketBool(m.active,b)&&rocketBool(p.rocket.methods.interactable,b)){r.next=now+700;invoke(m.press.method,b);event(s,'battle-action',{mode:r.mode,action:'max-attack'});return;}

   }}

   if(mask&2){for(const h of r.charges){const c=target(h);if(!alive(c)||!rocketBool(m.active,c))continue;const legacy=exact(c,classes[BATTLE_TYPES[9308]]),cm=legacy?m.legacyCharged:p.rocket.vnext.methods.charged;

    if(!rocketBool(cm,c)||(!legacy&&!rocketBool(p.rocket.vnext.methods.visible,c)))continue;const b=readPtr(c,legacy?t.fields.legacyButton:p.rocket.vnext.fields.button);

    if(b.isNull()||!alive(b)||!rocketBool(m.active,b)||!rocketBool(p.rocket.methods.interactable,b))continue;r.next=now+600;invoke((legacy?m.legacyCharge:p.rocket.vnext.methods.charge).method,c);event(s,'battle-action',{mode:r.mode,action:'charged'});return;

   }}

   if(!(mask&1)||!r.gesture)return;const g=target(r.gesture);if(!alive(g)||!rocketBool(m.active,g))return;

   if(!r.legacy&&!present(g,p.rocket.vnext.fields.enabled,1))return;

   const tap=readPtr(g,r.legacy?t.fields.legacyTap:p.rocket.vnext.fields.tap);if(tap.isNull())return;const args=Memory.alloc(16);args.writePointer(tap);args.add(8).writePointer(ptr(0));

   const method=r.legacy?m.legacyFast:r.mode===2?m.maxFast:m.raidFastAction;r.next=now+150;invoke(method.method,g,r.mode===0?undefined:args);if(now-r.lastLog>5000){r.lastLog=now;event(s,'battle-action',{mode:r.mode,action:'quick'});}

  }catch(e){r.failed=true;event(s,'battle-error',{mode:r.mode,reason:String(e)});}

 }

 if(p.battles){const t=p.battles,m=t.methods;

  function watch(method,callback){s.listeners.push(Interceptor.attach(method.address,{onEnter(a){if(!unity(this.threadId)||s.stopping)return;try{callback(a);}catch(e){battleState.failed=true;event(s,'battle-error',{reason:String(e)});}}}));}

  for(const action of [m.legacyFast,m.legacyCharge])watch(action,a=>{if(battleState.scope&&battleState.mode===1)event(s,'cooldown-action',{action:'Gym battle'});});
  watch(m.raidWarning,a=>{if(exact(a[0],classes[BATTLE_TYPES[31623]]))battleDodgeCue(0);});

  watch(m.maxWarning,a=>{if(exact(a[0],classes[BATTLE_TYPES[31263]]))battleDodgeCue(2);});

  s.listeners.push(Interceptor.attach(m.gymWarning.address,{onEnter(a){this.warning=false;if(unity(this.threadId)&&!s.stopping&&battleState.mode===1&&exact(a[0],t.gymIterator)){const state=readS32(a[0],t.gymWarningState);this.warning=state===0||state===1;this.scope=battleState.scope;}},onLeave(ret){if(this.warning&&this.scope===battleState.scope&&ret.toInt32()===0)battleDodgeCue(1);}}));

  for(const scope of t.scopes){watch(scope.enter,a=>{battleClear();if(exact(a[0],scope.klass)){battleState.scope=hold(a[0]);battleState.mode=scope.mode;event(s,'battle-scope',{mode:scope.mode,active:true});}});watch(scope.exit,a=>{if(battleState.scope&&target(battleState.scope).equals(a[0])){event(s,'battle-scope',{mode:battleState.mode,active:false});battleClear();}});}

  function captureGesture(a,legacy){if(!battleState.scope)return;const mode=battleState.mode,k=legacy?BATTLE_TYPES[9182]:mode===2?BATTLE_TYPES[31285]:BATTLE_TYPES[31499];if((legacy&&mode!==1)||!exact(a[0],classes[k]))return;battleDropGesture();battleState.gesture=hold(a[0]);battleState.legacy=legacy;event(s,'battle-input',{mode,legacy});}

  for(const method of [m.enable,m.buttons])watch(method,a=>captureGesture(a,false));for(const method of [m.legacyEnable,m.legacyButtons])watch(method,a=>captureGesture(a,true));

  for(const method of [m.disable,m.legacyDisable,m.destroy])watch(method,a=>{if(battleState.gesture&&target(battleState.gesture).equals(a[0]))battleDropGesture();});

  watch(p.rocket.vnext.methods.observe,a=>{if(battleState.scope&&exact(a[0],classes[RVCHARGE]))battleCapture(battleState.charges,a[0]);});

  watch(m.legacyInit,a=>{if(battleState.scope&&battleState.mode===1&&exact(a[0],classes[BATTLE_TYPES[9308]]))battleCapture(battleState.charges,a[0]);});

  watch(m.maxRefresh,a=>{if(battleState.scope&&battleState.mode===2&&exact(a[0],classes[BATTLE_TYPES[31280]]))battleCapture(battleState.maxMoves,a[0]);});

  watch(m.maxCleanup,a=>{const list=battleState.maxMoves;for(let i=list.length-1;i>=0;i--)if(target(list[i]).equals(a[0])){freeHandle(list[i]);list.splice(i,1);}});

 }


 // VGP serializes ordinary map RPCs. Unknown outcomes never cause a repeated throw.
 const vgpState={transfer:null,markerAt:0,pending:null,next:0,seen:new Map(),status:'',scanAt:0,turn:0,blocked:false,rpcMethod:null,reflection:null};
 function vgpStatus(message){if(message!==vgpState.status){vgpState.status=message;event(s,'vgp-status',{message});}}
 // Keep terminal targets suppressed; retry known non-terminal results without moving.
 function vgpRetry(q,now,delay){if(q&&q.key&&q.phase!=='spin')vgpState.seen.set(q.key,now+delay);}
 function vgpCatchDelay(status){const c=p.vgp.catchStates;
  if(status===c.CatchSuccess||status===c.CatchFlee)return 3600000;
  if(status===c.CatchEscape||status===c.CatchMissed||status===c.CatchItemReplacement)return 5000;
  return 30000;
 }
 function vgpDrop(){const q=vgpState.pending;if(q){freeHandle(q.promise);freeHandle(q.target);freeHandle(q.bag);vgpState.pending=null;event(s,'vgp-marker',{visible:false});}}
 function vgpField(o,name){let k=api.object_get_class(o);for(let i=0;i<16&&!k.isNull();i++,k=p.vgp.parent(k)){const f=api.class_get_field_from_name(k,Memory.allocUtf8String(name));if(!f.isNull()){const off=Number(api.field_get_offset(f));if(off<16||off>512)throw Error('vgp-field:'+name);return f;}}return null;}
 function vgpPromise(o){const complete=vgpField(o,'completeCalled'),error=vgpField(o,'errorCalled'),value=vgpField(o,'completedValue'),status=vgpField(o,'statusErrorCalled');if(!complete||!error||!value)throw Error('vgp-promise-shape');if(present(o,error,1)||(status&&present(o,status,1)))return {error:true};return present(o,complete,1)?{value:readPtr(o,value)}:null;}
 function vgpVirtual(m,o,args){return invoke(api.object_get_virtual_method(o,m.method),o,args);}
 function vgpBool(m,o){const h=hold(vgpVirtual(m,o));try{return api.object_unbox(target(h)).readU8()!==0;}finally{freeHandle(h);}}
 function vgpDistance(lat,lon,originLat=s.vgpLat,originLon=s.vgpLon){const d=Math.PI/180,a=originLat*d,b=lat*d,x=(lat-originLat)*d,y=(lon-originLon)*d,z=Math.sin(x/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(y/2)**2;return 6371000*2*Math.asin(Math.sqrt(Math.min(1,z)));}
 function vgpSpinMethod(root){const t=p.vgp,r=vgpState;if(r.rpcMethod)return r.rpcMethod;
  const generic=api.class_get_method_from_name(classes[VGP.rpc],Memory.allocUtf8String('SendRpc'),5);if(generic.isNull()||!api.method_is_generic(generic)||api.method_get_param_count(generic)!==5)throw Error('vgp-rpc-definition');
  const reflection=root(p.items.lookup.reflect(generic,classes[VGP.rpc])),types=root(t.array(classes[VGP.type],2));
  for(const [i,k]of [classes[VGP.request],classes[SPINRESULT]].entries()){const value=root(p.items.lookup.typeObject(api.class_get_type(k)));t.barrier(types,types.add(32+i*8),value);}
  const make=api.class_get_method_from_name(api.object_get_class(reflection),Memory.allocUtf8String('MakeGenericMethod'),1);if(make.isNull())throw Error('vgp-generic-method');
  const closed=root(invoke(make,reflection,itemArgs([types]))),m=t.unreflect(closed);if(m.isNull()||!api.method_is_inflated(m)||api.method_get_param_count(m)!==5)throw Error('vgp-closed-rpc');
  r.reflection=hold(closed);r.rpcMethod=m;return m;
 }

 function vgpMark(now){const r=vgpState,t=p.vgp.marker,q=r.pending;if(!t||!q||now-r.markerAt<100)return;r.markerAt=now;const roots=[],root=o=>{roots.push(hold(o));return o;};
  try{const o=target(q.target);if(now>=s.vgpLease||!alive(o)){event(s,'vgp-marker',{visible:false});return;}
   const camera=root(invoke(t.camera.method,ptr(0)));if(!alive(camera))return;const transform=root(invoke(t.transform.method,o)),position=root(invoke(t.position.method,transform)),vector=Memory.alloc(12);vector.writeByteArray(api.object_unbox(position).readByteArray(12));
   const screen=root(invoke(t.project.method,camera,itemArgs([vector]))),v=api.object_unbox(screen),w=itemInt(t.width,ptr(0)),h=itemInt(t.height,ptr(0)),x=v.readFloat()/w,y=1-v.add(4).readFloat()/h,z=v.add(8).readFloat();
   event(s,'vgp-marker',{visible:z>0&&x>=0&&x<=1&&y>=0&&y<=1,x,y,action:q.phase==='spin'?'spin':'catch'});
  }catch(e){event(s,'vgp-marker',{visible:false});}finally{for(const h of roots)freeHandle(h);}
 }
 function vgpQueueTransfer(response,bag,now){if(!s.transferEnabled||!p.transfer||!p.details||!present(response,fields.caughtId,8))return;
  vgpState.transfer={vgp:true,epoch:s.epoch,response:hold(response),vgpBag:hold(bag),capturedKey:capturedKey(response),deadline:now+10000};vgpStatus('Checking auto-transfer');
 }
 function vgpTransferTick(now){const r=vgpState.transfer;if(!r)return false;
  const done=()=>{releaseRecord(r);vgpState.transfer=null;};
  if(s.stopping||!s.transferEnabled||r.epoch!==s.epoch||now>=s.allowedUntil||now>=s.vgpLease){done();return false;}
  if(r.transferRequested){if(r.transferComplete||r.transferFailed){vgpStatus(r.transferComplete?'Transferred':'Transfer error');done();return false;}if(now>=r.transferDeadline){finishTransfer(r.capturedKey,false,'response-timeout');done();return false;}return true;}
  if(now>=r.deadline){vgpStatus('Caught; transfer inventory update timed out');done();return false;}
  const id=Memory.alloc(8);api.field_get_value(target(r.response),fields.caughtId,id);const pokemon=invoke(p.transfer.methods.get.method,target(r.vgpBag),itemArgs([id]));if(pokemon.isNull())return true;
  if(!exact(pokemon,classes[PK])||capturedKey(pokemon,p.details.fields.id)!==r.capturedKey){done();return false;}
  r.pokemon=hold(pokemon);r.vgpGm=hold(readPtr(target(r.vgpBag),p.vgp.f.bagGm));transferCatch(r,s.thread);
  if(r.transferRequested){vgpStatus('Transferring caught Pokemon');return true;}
  vgpStatus(r.transferFailed?'Caught; transfer check failed':'Kept: '+(r.transferReason||'protected'));done();return false;
 }

 let nextMapPoi=0;
 function mapPoiTick(now){
  if(!s.mapPoiLease||now>=s.mapPoiLease||s.stopping||now<nextMapPoi)return;
  nextMapPoi=now+3000;
  if(!p.mapPoi){event(s,'map-pois',{points:[],error:p.mapPoiError||'Unavailable'});return;}
  const roots=[],root=o=>{if(o&&typeof o.isNull==='function'&&!o.isNull())roots.push(hold(o));return o;};
  try{
   const t=p.vgp,q=p.mapPoi,points=[],seen=new Set(),l=p.items.lookup,wall=Date.now();
   const number=(o,f)=>{const b=Memory.alloc(8);api.field_get_value(o,f,b);return b.readDouble();};
   const millis=(o,f)=>{const b=Memory.alloc(8);api.field_get_value(o,f,b);return b.readU64().toNumber();};
   for(const [kind,klass] of [['stop',classes[VGP.stop]],['gym',q.gym]]){
    const array=root(invoke(t.m.findAll.method,ptr(0),itemArgs([l.typeObject(api.class_get_type(klass))])));
    if(array.isNull())continue;const count=array.add(24).readU64().toNumber();if(count>2048)throw Error('map-count');
    for(let i=0;i<count&&points.length<512;i++){
     const obj=array.add(32+i*8).readPointer();if(!exact(obj,klass)||!alive(obj))continue;
     const fort=root(vgpVirtual(t.m.fort,obj));if(!exact(fort,classes[VGP.fort]))continue;
     const id=readPtr(fort,t.f.fortId);if(id.isNull())continue;const length=id.add(16).readS32();if(length<1||length>256)continue;const key=id.add(20).readUtf16String(length);if(seen.has(key))continue;seen.add(key);
     const lat=number(fort,t.f.fortLat),lon=number(fort,t.f.fortLon);if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
     let raidEnd=0,egg=false,raidStart=0,team=null,teamId=null,slots=null,tier=null,level=null,boss=null;
     if(kind==='gym'){
      // Each optional read is isolated: a malformed field on one gym must not drop the whole snapshot.
      if(q.teamMethod&&q.teamNames){try{const bx=root(invoke(q.teamMethod.method,obj));if(!bx.isNull()){const tv=api.object_unbox(bx).readS32();teamId=tv;if(typeof q.teamNames[tv]==='string')team=q.teamNames[tv];}}catch(_){}}
      if(q.gymDisplay&&q.slots&&q.gymDisplayClass){try{const gd=root(readPtr(fort,q.gymDisplay));if(exact(gd,q.gymDisplayClass)){const sv=readS32(gd,q.slots);if(Number.isInteger(sv)&&sv>=0&&sv<=6)slots=sv;}}catch(_){}}
      const raid=root(readPtr(fort,q.info));
      if(exact(raid,q.raid)){
       const hidden=Memory.alloc(1);api.field_get_value(raid,q.hidden,hidden);
       const start=millis(raid,q.spawn),end=millis(raid,q.end),battle=millis(raid,q.battle);
       if(!hidden.readU8()&&start<=wall&&end>wall){
        raidEnd=end;egg=battle>wall;raidStart=battle;
        if(q.level){try{const lv=readS32(raid,q.level);level=lv;if(q.raidTiers&&typeof q.raidTiers[lv]==='string')tier=q.raidTiers[lv];}catch(_){}}
        if(!egg&&q.boss&&q.bossId&&q.bossClass){try{const pkm=root(readPtr(raid,q.boss));if(exact(pkm,q.bossClass)){const sp=readS32(pkm,q.bossId);if(Number.isInteger(sp)&&sp>0&&sp<100000)boss=sp;}}catch(_){}}
       }
      }
     }
     const point={id:key,lat,lon,kind,raidEnd,egg};
     if(raidStart)point.raidStart=raidStart;
     if(team!=null)point.team=team;
     if(teamId!=null)point.teamId=teamId;
     if(slots!=null)point.slots=slots;
     if(tier!=null)point.tier=tier;
     if(level!=null)point.level=level;
     if(boss!=null)point.boss=boss;
     points.push(point);
    }
   }
   event(s,'map-pois',{points});
  }catch(e){event(s,'map-pois',{points:[],error:String(e).slice(0,120)});}
  finally{for(const h of roots)freeHandle(h);}
 }
 function vgpTick(now){const t=p.vgp,r=vgpState;if(!t)return;
  if(s.stopping){vgpDrop();if(r.transfer){releaseRecord(r.transfer);r.transfer=null;}freeHandle(r.reflection);r.reflection=null;r.rpcMethod=null;return;}
  const allowed=()=>s.vgpMask&&now<s.vgpLease;
  const roots=[],root=o=>{if(o&&typeof o.isNull==='function'&&!o.isNull())roots.push(hold(o));return o;};
  try{
   vgpMark(now);if(vgpTransferTick(now))return;
   if(r.pending){const q=r.pending,state=vgpPromise(target(q.promise));if(!state){if(now>q.deadline){vgpDrop();r.blocked=true;vgpStatus('Response timed out; toggle VGP to resume');}return;}
    if(state.error||state.value.isNull()){vgpRetry(q,now,30000);vgpDrop();r.next=now+3000;vgpStatus('Request rejected');return;}
    root(state.value);
    if(q.phase==='encounter'){
     if(!allowed()||!(s.vgpMask&1)||!alive(target(q.target))){vgpRetry(q,now,5000);vgpDrop();return;}
     const bag=root(readPtr(target(itemState.service),p.items.fields.bag));if(itemInt(t.m.itemCount,bag,itemArgs([itemNumber(1)]))<1){vgpRetry(q,now,5000);vgpDrop();vgpStatus('Out of red Poke Balls');return;}
     const ball=Memory.alloc(12);ball.writeByteArray(new Uint8Array(12));ball.writeS32(1);ball.add(4).writeFloat(1); // ordinary straight throw, no grade bonus
     const promise=invoke(t.m.capture.method,target(q.target),itemArgs([ball,ptr(0)]));freeHandle(q.promise);q.promise=hold(promise);q.phase='catch';q.deadline=now+20000;event(s,'vgp-request',{action:'catch'});event(s,'cooldown-action',{action:'VGP ball throw'});return;
    }
    const catchStatus=q.phase==='catch'&&exact(state.value,classes[RESP])?readS32(state.value,t.f.catchStatus):null;
    if(q.phase==='catch')vgpRetry(q,now,vgpCatchDelay(catchStatus));
    const success=q.phase==='catch'?catchStatus===p.success:exact(state.value,classes[SPINRESULT])&&readS32(state.value,t.f.result)===t.spinSuccess;
    if(q.phase==='spin'&&success&&alive(target(q.target))){const until=Memory.alloc(8);api.field_get_value(state.value,t.f.until,until);vgpVirtual(t.m.cooldown,target(q.target),itemArgs([until]));}
    const action=q.phase;if(success&&action==='catch')vgpQueueTransfer(state.value,target(q.bag),now);vgpDrop();r.next=now+2500;itemState.next=0;if(s.itemEnabled)itemState.vgpCleanupUntil=now+20000;vgpStatus(success?(action==='catch'?'Pokemon caught':'PokeStop spun'):(action==='catch'?'Pokemon not caught':'Spin unsuccessful'));event(s,'vgp-result',{action,success,status:catchStatus,retryMs:action==='catch'&&!success?vgpCatchDelay(catchStatus):null});return;
   }
   if(!s.vgpMask){r.blocked=false;vgpStatus('Off');return;}if(!allowed()){vgpStatus('Waiting for the map');return;}if(r.blocked||now<r.next)return;if(s.itemEnabled&&now<itemState.vgpCleanupUntil){vgpStatus('Cleaning inventory');return;}r.next=now+2500;
   if(!itemState.service){vgpStatus('Waiting for inventory');return;}
   const l=p.items.lookup,map=root(invoke(l.find.method,ptr(0),itemArgs([l.typeObject(api.class_get_type(l.map))]))),container=root(invoke(l.container.method,map));
   const resolve=key=>root(invoke(l.resolve.method,container,itemArgs([l.typeObject(api.class_get_type(classes[VGP[key]]))])));
   const player=resolve('playerContract'),pokemonBag=resolve('bagContract'),bag=root(readPtr(target(itemState.service),p.items.fields.bag));
   if(!exact(player,classes[VGP.player])||!exact(pokemonBag,classes[BAG])||!exact(bag,classes[IBAG]))throw Error('vgp-service-type');
   const balls=itemInt(t.m.itemCount,bag,itemArgs([itemNumber(1)])),stored=itemInt(t.m.pokemonCount,pokemonBag),capacity=itemInt(t.m.maxPokemon,player);
   const catchBlock=!(s.vgpMask&1)?'Pokemon catching disabled':balls<1?'Out of red Poke Balls':stored>=capacity?'Pokemon storage full':'';
   const canCatch=!catchBlock,scan={balls,stored,capacity,catchBlock,total:0,hidden:0,outOfRange:0,recent:0,invalid:0};
   const canSpin=(s.vgpMask&2)&&itemInt(t.m.totalItems,bag)<itemInt(t.m.maxItems,player);
   if(!canCatch&&!canSpin){vgpStatus(catchBlock||'Item bag full');return;}
   for(const [key,expiry]of r.seen)if(expiry<=now)r.seen.delete(key);if(r.seen.size>=2048){vgpStatus('Waiting for recent targets to expire');return;}
   const order=(r.turn++%2)?['spin','catch']:['catch','spin'];
   for(const action of order){if(action==='catch'?!canCatch:!canSpin)continue;const klass=classes[VGP[action==='catch'?'wild':'stop']],array=root(invoke(t.m.findAll.method,ptr(0),itemArgs([l.typeObject(api.class_get_type(klass))]))),count=array.add(24).readU64().toNumber();if(count>2048)throw Error('vgp-map-count');
    for(let i=0;i<count;i++){const o=array.add(32+i*8).readPointer();if(action==='catch')scan.total++;if(!exact(o,klass)||!alive(o)){if(action==='catch')scan.invalid++;continue;}let key,fort=null;
     if(action==='catch'){if(!vgpBool(t.m.visible,o)){scan.hidden++;continue;}const loc=root(invoke(t.m.location.method,o)),v=api.object_unbox(loc);const distance=vgpDistance(v.readDouble(),v.add(8).readDouble());if(!Number.isFinite(distance)||distance>40){scan.outOfRange++;continue;}const id=root(invoke(t.m.id.method,o));key='p'+api.object_unbox(id).readU64().toString();}
     else{if(!vgpBool(t.m.active,o)||!vgpBool(t.m.range,o)||vgpBool(t.m.closed,o)||vgpBool(t.m.cooling,o))continue;fort=root(vgpVirtual(t.m.fort,o));if(!exact(fort,classes[VGP.fort]))continue;const id=readPtr(fort,t.f.fortId);if(id.isNull())continue;key='s'+id.add(20).readUtf16String(Math.min(256,id.add(16).readS32()));}
     if(r.seen.has(key)){if(action==='catch')scan.recent++;continue;}r.seen.set(key,now+(action==='catch'?30000:300000));r.pending={key,target:hold(o),bag:hold(pokemonBag),promise:null,phase:action==='catch'?'encounter':'spin',deadline:now+20000};
     let promise;
     if(action==='catch')promise=invoke(t.m.encounter.method,o);
     else{const request=root(api.object_new(classes[VGP.request]));invoke(t.m.ctor.method,request);api.field_set_value_object(request,t.f.id,readPtr(fort,t.f.fortId));
      for(const [field,value]of [[t.f.lat,s.vgpLat],[t.f.lon,s.vgpLon]]){const b=Memory.alloc(8);b.writeDouble(value);api.field_set_value(request,field,b);}
      for(const [dst,src]of [[t.f.targetLat,t.f.fortLat],[t.f.targetLon,t.f.fortLon]]){const b=Memory.alloc(8);api.field_get_value(fort,src,b);api.field_set_value(request,dst,b);}
      const rpcField=vgpField(bag,'cynr'),rpc=root(readPtr(bag,rpcField));if(!exact(rpc,classes[VGP.rpc]))throw Error('vgp-rpc-type');promise=invoke(vgpSpinMethod(root),rpc,itemArgs([itemNumber(t.rpcId),request,itemNumber(0),itemNumber(10000),itemNumber(0)]));event(s,'vgp-request',{action:'spin'});
     }
     r.pending.promise=hold(promise);vgpStatus(action==='catch'?'Catching nearby Pokemon':'Spinning nearby PokeStop');return;
    }
   }if(now-r.scanAt>=10000){r.scanAt=now;event(s,'vgp-scan',scan);}
   vgpStatus(catchBlock||(scan.recent?'Waiting for Pokemon retry / new targets':scan.outOfRange?'Nearby Pokemon outside 40m catch range':'Watching nearby Pokemon and PokeStops'));
  }catch(e){vgpDrop();if(r.transfer){releaseRecord(r.transfer);r.transfer=null;}r.blocked=true;vgpStatus('Paused: '+String(e));event(s,'vgp-error',{reason:String(e)});}finally{for(const h of roots)freeHandle(h);}
 }
 event(s,'map-poi-ready',{available:!!p.mapPoi,reason:p.mapPoiError,detailsError:p.mapPoi&&p.mapPoi.extraError});
 event(s,'vgp-ready',{available:!!p.vgp,reason:p.vgpError,marker:!!(p.vgp&&p.vgp.marker),markerError:p.vgp&&p.vgp.markerError});
 event(s,'native-ready',{available:!!p.vgp,screen:!!p.native,screenError:p.nativeError,berries:!!p.berries});
 event(s,'gymfeed-ready',{available:!!p.gymFeed,reason:p.gymFeedError});
 event(s,'research-ready',{available:!!p.research,reason:p.researchError});

 // ---- Rasiel-native engine: encounter/catch/spin ----
 const nativeState={pending:null,next:0,seen:new Map(),status:'',scanAt:0,turn:0,blocked:false};s.nativeState=nativeState;
 function nativeStatus(message){if(message!==nativeState.status){nativeState.status=message;event(s,'native-status',{message});}}
 function nativeString(o){if(o.isNull())return '';const n=api.string_length(o);if(n<1||n>256)return '';return api.string_chars(o).readUtf16String(n);}
 function nativeDrop(){const q=nativeState.pending;if(q){if(q.promise)freeHandle(q.promise);if(q.screen)freeHandle(q.screen);freeHandle(q.target);freeHandle(q.bag);nativeState.pending=null;}}
 function nativeBallCounts(bag){const t=p.vgp,counts={};for(const id of [1,2,3])counts[id]=itemInt(t.m.itemCount,bag,itemArgs([itemNumber(id)]));return counts;}
 function nativeThrowData(spec){
  const v=Memory.alloc(12);v.writeByteArray(nativeThrowBytes(spec));return v;
 }
 function nativeFindScreen(){
  // EncounterInteractionState is not a UnityEngine.Object in every build, so prefer the
  // live scope captured by the normal EnterState hook. Fall back to FindObjectsOfType.
  if(berryState.scope){const o=target(berryState.scope);if(exact(o,classes[BERRY])&&alive(o))return hold(o);}
  if(!p.items||!p.items.lookup)return null;
  const l=p.items.lookup,array=invoke(p.vgp.m.findAll.method,ptr(0),itemArgs([l.typeObject(api.class_get_type(classes[BERRY]))]));if(array.isNull())return null;
  const h=hold(array);try{const a=target(h),count=a.add(24).readU64().toNumber();if(count>2048)throw Error('native-screen-count');for(let i=0;i<count;i++){const o=a.add(32+i*8).readPointer();if(exact(o,classes[BERRY])&&alive(o))return hold(o);}return null;}finally{freeHandle(h);}
 }
 function nativeIssueBall(q,now){
  const data=nativeThrowData(nativeThrowSpec(q.ball,s.nativeCurve,s.nativeGrade));
  const promise=invoke(p.vgp.m.capture.method,target(q.target),itemArgs([data,ptr(0)]));
  q.promise=hold(promise);q.phase='catch';q.deadline=now+20000;
  event(s,'native-request',{action:'catch',mode:'direct',ball:q.ball,grade:s.nativeGrade,curve:!!s.nativeCurve});
  event(s,'cooldown-action',{action:'Rasiel native ball throw'});
 }
 function nativeTick(now){
  const t=p.vgp,r=nativeState;
  if(!t)return;
  if(s.stopping){nativeDrop();return;}
  if(!s.nativeMask){r.blocked=false;nativeDrop();nativeStatus('Off');return;}
  if(!p.items){nativeStatus('Waiting for inventory support');return;}
  const allowed=()=>s.nativeMask&&now<s.nativeLease;
  const roots=[],root=o=>{if(o&&typeof o.isNull==='function'&&!o.isNull())roots.push(hold(o));return o;};
  try{
   if(!allowed()){nativeDrop();nativeStatus('Waiting for the map');return;}
   if(r.pending){
    const q=r.pending;
    if(q.phase==='encounter'){
     const state=vgpPromise(target(q.promise));
     if(!state){if(now>q.deadline){freeHandle(q.promise);q.promise=null;q.phase='direct';q.deadline=now+20000;}return;}
     if(state.error||state.value.isNull()){r.seen.set(q.key,now+5000);nativeDrop();r.next=now+2500;nativeStatus('Encounter rejected');return;}
     freeHandle(q.promise);q.promise=null;
     if(!allowed()||!(s.nativeMask&1)||!alive(target(q.target))){r.seen.set(q.key,now+5000);nativeDrop();return;}
     if(s.nativeScreenFree||!p.native){q.phase='direct';}
     else{
      q.screenDeadline=now+2500;
      const screen=nativeFindScreen();
      if(screen){q.screen=screen;q.scopeBound=!!berryState.scope;q.phase='screen';q.attemptAt=now+500;q.deadline=now+20000;}
      else{q.phase='screen-wait';q.deadline=now+20000;return;}
     }
    }
    if(q.phase==='screen-wait'){
     const screen=nativeFindScreen();
     if(screen){q.screen=screen;q.scopeBound=!!berryState.scope;q.phase='screen';q.attemptAt=now+500;q.deadline=now+20000;return;}
     if(now<q.screenDeadline)return;
     q.phase='direct';
    }
    if(q.phase==='direct'){
     if(!alive(target(q.target))){r.seen.set(q.key,now+5000);nativeDrop();r.next=now+1200;nativeStatus('Target left');return;}
     r.seen.set(q.key,now+30000);nativeIssueBall(q,now);return;
    }
    if(q.phase==='screen'){
     const screen=q.screen?target(q.screen):ptr(0),live=!!q.screen&&alive(screen)&&(!berryState.scope||target(berryState.scope).equals(screen))&&(!q.scopeBound||!!berryState.scope);
     if(!live){r.seen.set(q.key,now+300000);nativeDrop();r.next=now+1200;nativeStatus('Encounter finished');event(s,'native-result',{action:'catch',mode:'screen',success:null,reason:'encounter-finished'});return;}
     if(now<q.attemptAt)return;
     if(!q.attempted){
      try{invoke(p.native.selectBall.method,screen,itemArgs([itemNumber(q.ball)]));}catch(_){}
      if(q.berry&&itemInt(t.m.itemCount,target(q.bag),itemArgs([itemNumber(q.berry)]))>0)try{invoke(p.berries.methods.select.method,screen,itemArgs([itemNumber(q.berry)]));}catch(_){}
      try{invoke(p.native.attempt.method,screen,itemArgs([nativeThrowData(nativeThrowSpec(q.ball,s.nativeCurve,s.nativeGrade))]));q.attempted=true;event(s,'native-request',{action:'catch',mode:'screen',ball:q.ball,grade:s.nativeGrade,berry:q.berry||0});event(s,'cooldown-action',{action:'Rasiel native ball throw'});}catch(e){q.phase='direct';nativeIssueBall(q,now);q.phase='catch';return;}
     }
     if(now>=q.deadline){try{invoke(p.native.run.method,screen,ptr(0));}catch(_){}r.seen.set(q.key,now+5000);nativeDrop();r.next=now+3000;nativeStatus('Encounter timed out; ran away');event(s,'native-result',{action:'catch',mode:'screen',success:false,reason:'timeout'});}
     return;
    }
    const state=vgpPromise(target(q.promise));
    if(!state){if(now>q.deadline){r.seen.set(q.key,now+5000);nativeDrop();r.blocked=true;nativeStatus('Response timed out; toggle Auto Catch to resume');}return;}
    if(state.error||state.value.isNull()){r.seen.set(q.key,now+5000);nativeDrop();r.next=now+3000;nativeStatus('Request rejected');return;}
    root(state.value);
    if(q.phase==='catch'){
     const status=exact(state.value,classes[RESP])?readS32(state.value,t.f.catchStatus):null;
     const success=status===p.success;
     r.seen.set(q.key,now+(success?3600000:vgpCatchDelay(status)));
     if(success&&s.transferEnabled&&p.transfer&&p.details&&present(state.value,fields.caughtId,8))vgpQueueTransfer(state.value,target(q.bag),now);
     nativeDrop();r.next=now+2500;itemState.next=0;if(s.itemEnabled)itemState.vgpCleanupUntil=now+20000;
     nativeStatus(success?'Pokemon caught':'Pokemon not caught');
     event(s,'native-result',{action:'catch',mode:'direct',success,status});
     return;
    }
    if(q.phase==='spin'){
     const success=exact(state.value,classes[SPINRESULT])&&readS32(state.value,t.f.result)===t.spinSuccess;
     if(success&&alive(target(q.target))){const until=Memory.alloc(8);api.field_get_value(state.value,t.f.until,until);vgpVirtual(t.m.cooldown,target(q.target),itemArgs([until]));}
     r.seen.set(q.key,now+(success?300000:5000));nativeDrop();r.next=now+2500;itemState.next=0;if(s.itemEnabled)itemState.vgpCleanupUntil=now+20000;
     nativeStatus(success?'PokeStop spun':'Spin unsuccessful');event(s,'native-result',{action:'spin',success});
     return;
    }
   }
   if(r.blocked||now<r.next)return;
   if(s.itemEnabled&&now<itemState.vgpCleanupUntil){nativeStatus('Cleaning inventory');return;}
   if(!itemState.service){nativeStatus('Waiting for inventory');return;}
   r.next=now+2500;
   const l=p.items.lookup,map=root(invoke(l.find.method,ptr(0),itemArgs([l.typeObject(api.class_get_type(l.map))]))),container=root(invoke(l.container.method,map));
   const resolve=key=>root(invoke(l.resolve.method,container,itemArgs([l.typeObject(api.class_get_type(classes[VGP[key]]))])));
   const player=resolve('playerContract'),pokemonBag=resolve('bagContract'),bag=root(readPtr(target(itemState.service),p.items.fields.bag));
   if(!exact(player,classes[VGP.player])||!exact(pokemonBag,classes[BAG])||!exact(bag,classes[IBAG]))throw Error('native-service-type');
   const counts=nativeBallCounts(bag),ball=nativeBallChoice(s.nativeBalls,counts),stored=itemInt(t.m.pokemonCount,pokemonBag),capacity=itemInt(t.m.maxPokemon,player);
   const catchBlock=!(s.nativeMask&1)?'Pokemon catching disabled':!ball?'Out of selected balls':stored>=capacity?'Pokemon storage full':'';
   const canCatch=!catchBlock,canSpin=(s.nativeMask&2)&&itemInt(t.m.totalItems,bag)<itemInt(t.m.maxItems,player);
   if(!canCatch&&!canSpin){nativeStatus(catchBlock||'Item bag full');return;}
   for(const [key,expiry]of r.seen)if(expiry<=now)r.seen.delete(key);
   if(r.seen.size>=2048){nativeStatus('Waiting for recent targets to expire');return;}
   const order=(r.turn++%2)?['spin','catch']:['catch','spin'];
   for(const action of order){
    if(action==='catch'?!canCatch:!canSpin)continue;
    const klass=classes[VGP[action==='catch'?'wild':'stop']],array=root(invoke(t.m.findAll.method,ptr(0),itemArgs([l.typeObject(api.class_get_type(klass))]))),count=array.add(24).readU64().toNumber();
    if(count>2048)throw Error('native-map-count');
    for(let i=0;i<count;i++){
     const o=array.add(32+i*8).readPointer();if(!exact(o,klass)||!alive(o))continue;
     if(action==='catch'){
      if(!vgpBool(t.m.visible,o))continue;
      const loc=root(invoke(t.m.location.method,o)),v=api.object_unbox(loc),distance=vgpDistance(v.readDouble(),v.add(8).readDouble(),s.nativeLat,s.nativeLon);
      if(!Number.isFinite(distance)||distance>40)continue;
      const id=root(invoke(t.m.id.method,o)),key='p'+api.object_unbox(id).readU64().toString();
      if(r.seen.has(key))continue;
      r.seen.set(key,now+30000);
      const promise=invoke(t.m.encounter.method,o);
      r.pending={key,target:hold(o),bag:hold(pokemonBag),promise:hold(promise),phase:'encounter',deadline:now+20000,screenDeadline:now+2500,screenSeen:0,screen:null,attempted:false,attemptAt:0,ball,berry:s.nativeBerry};
      nativeStatus('Encountering nearby Pokemon');event(s,'native-request',{action:'catch',mode:s.nativeScreenFree?'screen-free':'encounter',ball});return;
     }else{
      if(!vgpBool(t.m.active,o)||!vgpBool(t.m.range,o)||vgpBool(t.m.closed,o)||vgpBool(t.m.cooling,o))continue;
      const fort=root(vgpVirtual(t.m.fort,o));if(!exact(fort,classes[VGP.fort]))continue;
      const id=readPtr(fort,t.f.fortId);if(id.isNull())continue;const key='s'+nativeString(id);
      if(!key||key==='s'||r.seen.has(key))continue;
      r.seen.set(key,now+300000);
      const request=root(api.object_new(classes[VGP.request]));invoke(t.m.ctor.method,request);api.field_set_value_object(request,t.f.id,id);
      for(const [field,value]of [[t.f.lat,s.nativeLat],[t.f.lon,s.nativeLon]]){const b=Memory.alloc(8);b.writeDouble(value);api.field_set_value(request,field,b);}
      for(const [dst,src]of [[t.f.targetLat,t.f.fortLat],[t.f.targetLon,t.f.fortLon]]){const b=Memory.alloc(8);api.field_get_value(fort,src,b);api.field_set_value(request,dst,b);}
      const rpcField=vgpField(bag,'cynr'),rpc=root(readPtr(bag,rpcField));if(!exact(rpc,classes[VGP.rpc]))throw Error('native-rpc-type');
      const promise=invoke(vgpSpinMethod(root),rpc,itemArgs([itemNumber(t.rpcId),request,itemNumber(0),itemNumber(10000),itemNumber(0)]));
      r.pending={key,target:hold(o),bag:hold(pokemonBag),promise:hold(promise),phase:'spin',deadline:now+20000};
      nativeStatus('Spinning nearby PokeStop');event(s,'native-request',{action:'spin'});return;
     }
    }
   }
   if(now-r.scanAt>=15000){r.scanAt=now;event(s,'native-scan',{ball,counts,canCatch,canSpin,catchBlock});}
   nativeStatus(catchBlock||'Watching nearby Pokemon and PokeStops');
  }catch(e){nativeDrop();r.blocked=true;nativeStatus('Paused: '+String(e));event(s,'native-error',{reason:String(e)});}
  finally{for(const h of roots)freeHandle(h);}
 }

 // ---- Rasiel gym defender feeding ----
 const gymFeedState={pending:null,feed:null,next:0,gyms:new Map(),status:'',scanAt:0};s.gymFeedState=gymFeedState;
 const gymRpc={reflection:null,method:null};
 function gymFeedStatus(message){if(message!==gymFeedState.status){gymFeedState.status=message;event(s,'gymfeed-status',{message});}}
 function gymFeedDrop(){const q=gymFeedState.pending;if(q){if(q.promise)freeHandle(q.promise);if(q.gymId)freeHandle(q.gymId);if(q.target)freeHandle(q.target);gymFeedState.pending=null;}}
 function gymGetInfoMethod(root){
  const t=p.vgp;if(gymRpc.method)return gymRpc.method;
  const generic=api.class_get_method_from_name(classes[VGP.rpc],Memory.allocUtf8String('SendRpc'),5);if(generic.isNull()||!api.method_is_generic(generic)||api.method_get_param_count(generic)!==5)throw Error('gym-rpc-definition');
  const reflection=root(p.items.lookup.reflect(generic,classes[VGP.rpc])),types=root(t.array(classes[VGP.type],2));
  for(const [i,k]of [classes['Holoholo.Rpc.GymGetInfoProto'],classes['Holoholo.Rpc.GymGetInfoOutProto']].entries()){const value=root(p.items.lookup.typeObject(api.class_get_type(k)));t.barrier(types,types.add(32+i*8),value);}
  const make=api.class_get_method_from_name(api.object_get_class(reflection),Memory.allocUtf8String('MakeGenericMethod'),1);if(make.isNull())throw Error('gym-generic-method');
  const closed=root(invoke(make,reflection,itemArgs([types]))),m=t.unreflect(closed);if(m.isNull()||!api.method_is_inflated(m)||api.method_get_param_count(m)!==5)throw Error('gym-closed-rpc');
  gymRpc.reflection=hold(closed);gymRpc.method=m;return m;
 }
 function gymFeedTick(now){
  const t=p.vgp,r=gymFeedState;
  if(!t)return;
  if(s.stopping){gymFeedDrop();if(r.feed){if(r.feed.gymId)freeHandle(r.feed.gymId);r.feed=null;}if(gymRpc.reflection){freeHandle(gymRpc.reflection);gymRpc.reflection=null;gymRpc.method=null;}return;}
  if(!s.gymFeedEnabled||now>=s.gymFeedLease){if(!s.gymFeedEnabled){gymFeedDrop();if(r.feed){if(r.feed.gymId)freeHandle(r.feed.gymId);r.feed=null;}if(gymRpc.reflection){freeHandle(gymRpc.reflection);gymRpc.reflection=null;gymRpc.method=null;}gymFeedStatus('Off');}else if(!p.gymFeed)gymFeedStatus(p.gymFeedError?'Unavailable: '+p.gymFeedError:'Unavailable');else gymFeedStatus('Waiting for the map');return;}
  if(!p.gymFeed){gymFeedStatus('Unavailable');return;}
  if(!itemState.service){gymFeedStatus('Waiting for inventory');return;}
  const roots=[],root=o=>{if(o&&typeof o.isNull==='function'&&!o.isNull())roots.push(hold(o));return o;};
  let pendingGymId=null;
  try{
   if(r.pending){
    const q=r.pending,state=vgpPromise(target(q.promise));
    if(!state){if(now>q.deadline){gymFeedDrop();r.next=now+10000;gymFeedStatus('Gym info timed out');}return;}
    if(state.error||state.value.isNull()){gymFeedDrop();r.next=now+10000;gymFeedStatus('Gym info rejected');return;}
    const out=root(state.value);const gymId=q.gymId;q.gymId=null;gymFeedDrop();pendingGymId=gymId;
    if(!exact(out,p.gymFeed.outClass)){if(gymId)freeHandle(gymId);throw Error('gym-info-type');}
    if(readS32(out,p.gymFeed.f.result)!==p.gymFeed.success){if(gymId)freeHandle(gymId);r.gyms.set(q.key,{until:now+300000});r.next=now+5000;gymFeedStatus('Gym info unsuccessful');return;}
    const sd=root(readPtr(out,p.gymFeed.f.status));
    if(sd.isNull()){if(gymId)freeHandle(gymId);r.gyms.set(q.key,{until:now+1800000});r.next=now+2000;gymFeedStatus('Gym has no defenders');return;}
    if(!exact(sd,p.gymFeed.statusClass)){if(gymId)freeHandle(gymId);throw Error('gym-status-type');}
    const list=root(readPtr(sd,p.gymFeed.f.defenders));
    if(list.isNull()){if(gymId)freeHandle(gymId);r.gyms.set(q.key,{until:now+1800000});r.next=now+2000;gymFeedStatus('Gym has no defenders');return;}
    const n=itemInt(p.gymFeed.count,list,ptr(0)),defenders=[];
    for(let i=0;i<n&&i<20;i++){
     const d=invoke(p.gymFeed.item.method,list,itemArgs([itemNumber(i)]));if(!exact(d,p.gymFeed.defClass))continue;
     const mot=root(readPtr(d,p.gymFeed.f.motivated));if(!exact(mot,p.gymFeed.motClass))continue;
     const pok=root(readPtr(mot,p.gymFeed.f.pokemon));if(!exact(pok,classes[PK]))continue;
     const idb=Memory.alloc(8),mb=Memory.alloc(4);api.field_get_value(pok,p.gymFeed.f.pokemonId,idb);api.field_get_value(mot,p.gymFeed.f.motivation,mb);
     const id=idb.readU64(),motivation=mb.readFloat();
     if(id.compare(0)!==0&&Number.isFinite(motivation)&&motivation<0.999)defenders.push({id,motivation});
    }
    r.gyms.set(q.key,{until:now+1800000,feeds:0});
    if(!defenders.length){if(gymId)freeHandle(gymId);r.next=now+3000;gymFeedStatus('Gym defenders are motivated');return;}
    r.feed={key:q.key,gymId,defenders,index:0,feeds:0,next:now,deadline:now+60000};pendingGymId=null;
    r.next=now+1000;gymFeedStatus('Feeding gym defenders');
    return;
   }
   if(r.feed){
    const f=r.feed;
    if(now<f.next)return;
    if(f.feeds>=10||f.index>=f.defenders.length){if(f.gymId)freeHandle(f.gymId);gymFeedStatus('Fed '+f.feeds+' gym defender'+(f.feeds===1?'':'s'));r.feed=null;r.next=now+5000;return;}
    const bag=root(readPtr(target(itemState.service),p.items.fields.bag)),counts={};for(const id of [701,703,705,706,707])counts[id]=itemInt(t.m.itemCount,bag,itemArgs([itemNumber(id)]));
    const berry=gymBerryChoice(s.gymFeedBerry,counts);if(!berry){if(f.gymId)freeHandle(f.gymId);gymFeedStatus('Out of the selected berries');r.feed=null;r.next=now+60000;return;}
    const targetDefender=f.defenders[f.index],idb=Memory.alloc(8);idb.writeU64(targetDefender.id);
    invoke(p.gymFeed.useItem.method,bag,itemArgs([itemNumber(berry),idb,target(f.gymId)]));
    f.index++;f.feeds++;f.next=now+1500;event(s,'gymfeed-feed',{berry,count:f.feeds});
    gymFeedStatus('Feeding gym defenders ('+f.feeds+')');return;
   }
   if(now<r.next)return;
   r.next=now+15000;
   for(const [key,v]of r.gyms)if(v.until<=now)r.gyms.delete(key);
   const l=p.items.lookup,array=root(invoke(t.m.findAll.method,ptr(0),itemArgs([l.typeObject(api.class_get_type(p.gymFeed.gymClass))]))),count=array.add(24).readU64().toNumber();
   if(count>2048)throw Error('gym-map-count');
   for(let i=0;i<count;i++){
    const o=array.add(32+i*8).readPointer();if(!exact(o,p.gymFeed.gymClass)||!alive(o))continue;
    const fort=root(vgpVirtual(t.m.fort,o));if(!exact(fort,classes[VGP.fort]))continue;
    const id=readPtr(fort,t.f.fortId);if(id.isNull())continue;const key=nativeString(id);if(!key)continue;
    const latb=Memory.alloc(8),lonb=Memory.alloc(8);api.field_get_value(fort,t.f.fortLat,latb);api.field_get_value(fort,t.f.fortLon,lonb);
    const lat=latb.readDouble(),lon=lonb.readDouble();if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
    if(vgpDistance(lat,lon)>80)continue;
    if(r.gyms.has(key))continue;
    const request=root(api.object_new(p.gymFeed.reqClass));invoke(p.gymFeed.ctor.method,request);
    api.field_set_value_object(request,p.gymFeed.f.gymId,id);
    for(const [field,value]of [[p.gymFeed.f.playerLat,s.gymFeedLat],[p.gymFeed.f.playerLon,s.gymFeedLon],[p.gymFeed.f.gymLat,lat],[p.gymFeed.f.gymLon,lon]]){const b=Memory.alloc(8);b.writeDouble(value);api.field_set_value(request,field,b);}
    const bag=root(readPtr(target(itemState.service),p.items.fields.bag)),rpcField=vgpField(bag,'cynr'),rpc=root(readPtr(bag,rpcField));if(!exact(rpc,classes[VGP.rpc]))throw Error('gym-rpc-type');
    const promise=invoke(gymGetInfoMethod(root),rpc,itemArgs([itemNumber(p.gymFeed.rpcId),request,itemNumber(0),itemNumber(10000),itemNumber(0)]));
    r.gyms.set(key,{until:now+60000});r.pending={key,promise:hold(promise),gymId:hold(id),target:hold(o),deadline:now+20000};
    event(s,'gymfeed-request',{gym:key});gymFeedStatus('Checking gym defenders');return;
   }
   gymFeedStatus('Watching nearby gyms');
  }catch(e){if(pendingGymId)freeHandle(pendingGymId);gymFeedDrop();r.next=now+15000;gymFeedStatus('Paused: '+String(e));event(s,'gymfeed-error',{reason:String(e)});}
  finally{for(const h of roots)freeHandle(h);}
 }

 // ---- Field research claim/removal ----
 const researchState={next:0,status:'',seen:new Set(),service:null,rpc:null,serviceHold:null,rpcHold:null,blocked:false};s.researchState=researchState;
 function researchStatus(message){if(message!==researchState.status){researchState.status=message;event(s,'research-status',{message});}}
 function researchRelease(){const r=researchState;if(r.serviceHold)freeHandle(r.serviceHold);if(r.rpcHold)freeHandle(r.rpcHold);r.serviceHold=null;r.rpcHold=null;r.service=null;r.rpc=null;}
 function researchBool(m,self,args){const h=hold(invoke(m.method,self,args));try{const b=target(h);if(!exact(b,classes[BOOL]))throw Error('research-bool');return api.object_unbox(b).readU8()!==0;}finally{freeHandle(h);}}
 function researchNum(n,size){const b=Memory.alloc(size);if(size===8)b.writeU64(n);else if(size===4)b.writeS32(n);else if(size===2)b.writeU16(n);else b.writeU8(n);return b;}
 function researchCompleteArgs(id){
  // Build CompleteQuest arguments from the live parameter metadata rather than
  // assuming a fixed layout. Reference parameters are passed as null, value
  // parameters are zero-filled only when their size is known. Anything else
  // fails closed so we never invoke with a mismatched ABI.
  const m=p.research.m.complete.method,count=api.method_get_param_count(m),values=[id];
  for(let i=1;i<count;i++){
   const type=api.method_get_param(m,i),name=typeName(api,type),klass=api.class_from_type(type);
   if(!name||name.endsWith('&')||name.endsWith('*'))return null;
   if(klass.isNull())return null;
   if(!api.class_is_valuetype(klass)){values.push(ptr(0));continue;}
   if(name==='System.Boolean'){values.push(researchNum(0,1));continue;}
   if(api.class_is_enum(klass)){
    const base=typeName(api,api.class_enum_basetype(klass));
    if(base==='System.Int32'||base==='System.UInt32'){values.push(researchNum(0,4));continue;}
    if(base==='System.Int64'||base==='System.UInt64'){values.push(researchNum(0,8));continue;}
    return null;
   }
   if(name==='System.Int32'||name==='System.UInt32'){values.push(researchNum(0,4));continue;}
   if(name==='System.Int64'||name==='System.UInt64'){values.push(researchNum(0,8));continue;}
   const align=Memory.alloc(4),size=api.class_value_size(klass,align);
   if(size<1||size>16)return null;
   const b=Memory.alloc(size);b.writeByteArray(new Uint8Array(size));values.push(b);
  }
  return itemArgs(values);
 }
 function researchAddText(out,value){if(value.isNull())return;const n=api.string_length(value);if(n<1||n>1024)return;const text=researchNormalize(api.string_chars(value).readUtf16String(n));if(text&&!out.includes(text))out.push(text);}
 function researchTexts(display,root){const out=[];
  researchAddText(out,readPtr(display,p.research.f.title));researchAddText(out,readPtr(display,p.research.f.description));
  try{const subs=root(readPtr(display,p.research.f.subquests));if(!subs.isNull()){const n=itemInt(p.research.subCount,subs,ptr(0));for(let i=0;i<n&&i<16;i++){const sub=invoke(p.research.subItem.method,subs,itemArgs([itemNumber(i)]));if(!exact(sub,classes['Holoholo.Rpc.QuestDisplayProto']))continue;researchAddText(out,readPtr(sub,p.research.f.title));researchAddText(out,readPtr(sub,p.research.f.description));}}}catch(_){}
  return out;
 }
 function researchRewardToken(name,reward,root){
  const g=p.research.getters[name];if(!g)return null;const v=root(invoke(g.method,reward,ptr(0)));if(v.isNull())return null;
  if(name==='Exp'||name==='Stardust'||name==='Pokecoin'){const b=target(v);const prefix=name==='Exp'?'e:':name==='Stardust'?'s:':'coin:';
   if(exact(b,classes[INT]))return prefix+api.object_unbox(b).readS32();
   const long=classes['System.Int64'];if(long&&exact(b,long))return prefix+api.object_unbox(b).readS64();
   return null;
  }
  if(name==='Item'){if(!exact(v,classes['Holoholo.Rpc.ItemRewardProto'])||!p.research.rf.itemItem)return null;return 'i:'+readS32(v,p.research.rf.itemItem)+':'+readS32(v,p.research.rf.itemAmount);}
  if(name==='Candy'||name==='XlCandy'){if(!exact(v,classes['Holoholo.Rpc.PokemonCandyRewardProto'])||!p.research.rf.candyId)return null;return (name==='Candy'?'c:':'x:')+readS32(v,p.research.rf.candyId)+':'+readS32(v,p.research.rf.candyAmount);}
  if(name==='PokemonEncounter'){if(!exact(v,classes['Holoholo.Rpc.PokemonEncounterRewardProto'])||!p.research.rf.encDisplay)return null;const d=readPtr(v,p.research.rf.encDisplay);if(!exact(d,classes[DISPLAY]))return null;return 'p:'+readS32(d,p.research.rf.displayId);}
  if(name==='MegaResource'){if(!exact(v,classes['Holoholo.Rpc.PokemonCandyRewardProto'])||!p.research.rf.candyId)return null;return 'm:'+readS32(v,p.research.rf.candyId)+':'+readS32(v,p.research.rf.candyAmount);}
  return null;
 }
 function researchTokens(quest,root){const out=[];const list=root(readPtr(quest,p.research.f.rewards));if(list.isNull())return out;const n=itemInt(p.research.rewardCount,list,ptr(0));if(n<0||n>64)return out;
  for(let i=0;i<n;i++){const rw=invoke(p.research.rewardItem.method,list,itemArgs([itemNumber(i)]));if(!exact(rw,classes['Holoholo.Rpc.QuestRewardProto']))continue;const type=readS32(rw,p.research.f.type),name=p.research.rewardTypes[type];if(!name)continue;const token=researchRewardToken(name,rw,root);if(token&&!out.includes(token))out.push(token);}
  return out;
 }
 function researchVisit(list,root,visit){
  if(p.research.listCount&&p.research.listItem){const n=itemInt(p.research.listCount,list,ptr(0));for(let i=0;i<n&&i<256;i++){const q=invoke(p.research.listItem.method,list,itemArgs([itemNumber(i)]));if(!exact(q,classes['Holoholo.Rpc.QuestProto']))continue;if(visit(q))return true;}return false;}
  if(!p.research.enumerate||!p.research.move||!p.research.current||!p.research.dispose)return false;
  const en=root(invoke(p.research.enumerate.method,list,ptr(0)));if(en.isNull())return false;
  try{for(let i=0;i<256;i++){const more=researchBool(p.research.move,en,ptr(0));if(!more)break;const q=root(invoke(p.research.current.method,en,ptr(0)));if(!exact(q,classes['Holoholo.Rpc.QuestProto']))continue;if(visit(q))return true;}return false;}
  finally{try{invoke(p.research.dispose.method,en,ptr(0));}catch(_){}}
 }
 function researchResolve(container,roots,classesList,concrete){
  for(const k of classesList){try{const o=invoke(p.items.lookup.resolve.method,container,itemArgs([p.items.lookup.typeObject(api.class_get_type(k))]));if(!o.isNull()&&exact(o,concrete)){return roots.push(hold(o)),o;}}catch(_){}}
  return null;
 }
 function researchTick(now){
  const r=researchState;
  if(s.stopping){researchRelease();return;}
  if(!s.researchClaim&&!String(s.researchRules||'').trim()){researchRelease();researchStatus('Off');return;}
  if(!p.research){researchStatus(p.researchError?'Unavailable: '+p.researchError:'Unavailable');return;}
  if(now>=s.researchLease){researchStatus('Waiting for the map');return;}
  if(r.blocked||now<r.next)return;r.next=now+5000;
  if(r.seen.size>4096)r.seen.clear();
  const roots=[],root=o=>{if(o&&typeof o.isNull==='function'&&!o.isNull())roots.push(hold(o));return o;};
  try{
   if(!r.service||!r.rpc){
    if(!p.items||!p.items.lookup)throw Error('research-lookup');
    const map=root(invoke(p.items.lookup.find.method,ptr(0),itemArgs([p.items.lookup.typeObject(api.class_get_type(p.items.lookup.map))])));if(map.isNull())throw Error('research-map');
    const container=root(invoke(p.items.lookup.container.method,map));
    if(!r.service)r.service=researchResolve(container,roots,[classes['Niantic.Holoholo.Quests.QuestService'],classes['Niantic.Holoholo.Quests.IQuestService']],classes['Niantic.Holoholo.Quests.QuestService']);
    if(!r.rpc)r.rpc=researchResolve(container,roots,[classes['Niantic.Holoholo.Quests.QuestRpcService'],classes['Niantic.Holoholo.Quests.IQuestRpcService']],classes['Niantic.Holoholo.Quests.QuestRpcService']);
    // Keep each resolved service alive across ticks; the container may hand us
    // transient instances, and the temporary roots are released below. Hold
    // whichever one resolved even when the other still fails, so a retry never
    // dereferences a collected pointer.
    if(r.service&&!r.serviceHold)r.serviceHold=hold(r.service);
    if(r.rpc&&!r.rpcHold)r.rpcHold=hold(r.rpc);
    if(!r.service||!r.rpc)throw Error('quest-service-not-found');
   }
   const list=root(invoke(p.research.m.quests.method,r.service,ptr(0)));if(list.isNull()){researchStatus('No field research');return;}
   const rules=researchParseRules(s.researchRules),acted=researchVisit(list,root,quest=>{
    const id=readPtr(quest,p.research.f.id);if(id.isNull())return false;const qid=nativeString(id);if(!qid||r.seen.has(qid))return false;
    if(!researchBool(p.research.m.fieldBook,ptr(0),itemArgs([quest])))return false;
    if(rules.length){
     const display=root(invoke(p.research.m.display.method,r.service,itemArgs([id])));
     if(!exact(display,classes['Holoholo.Rpc.QuestDisplayProto'])){r.seen.add(qid);return false;}
     const texts=researchTexts(display,root),tokens=researchTokens(quest,root);
     if(researchShouldRemove(rules,texts,tokens)){
      invoke(p.research.m.remove.method,r.rpc,itemArgs([id]));r.seen.add(qid);event(s,'research-result',{action:'remove',quest:qid,texts,tokens});researchStatus('Removed field research');return true;
     }
    }
    if(s.researchClaim&&researchBool(p.research.m.claimable,ptr(0),itemArgs([quest,r.service]))){
     const args=researchCompleteArgs(id);if(!args)throw Error('research-complete-args');
     invoke(p.research.m.complete.method,r.service,args);
     r.seen.add(qid);
     event(s,'research-result',{action:'claim',quest:qid});researchStatus('Claimed field research');return true;
    }
    return false;
   });
   if(!acted)researchStatus('Watching field research');
  }catch(e){r.blocked=true;researchStatus('Paused: '+String(e));event(s,'research-error',{reason:String(e)});}
  finally{for(const h of roots)freeHandle(h);}
 }


 const itemState={service:null,next:0,pending:null,blocked:new Set(),config:null,rows:new Map(),invoking:false,filters:null,stage:''};

 function itemPermitted(){return !s.stopping&&s.now()<s.itemLease;}

 function itemInt(m,o,args){const h=hold(invoke(m.method,o,args));try{const b=target(h);if(!exact(b,classes[INT]))throw Error('item-count-type');return api.object_unbox(b).readS32();}finally{freeHandle(h);}}

 function itemArgs(values){const args=Memory.alloc(values.length*8);args.keepAlive=values;values.forEach((v,i)=>args.add(i*8).writePointer(v));return args;}

 function itemNumber(n){const out=Memory.alloc(4);out.writeS32(n);return out;}

 function itemTick(now){const t=p.items;if(!t)return;

  if(s.stopping){if(itemState.service)freeHandle(itemState.service);itemState.service=null;if(itemState.filters)for(const h of itemState.filters)if(h)freeHandle(h);itemState.filters=null;return;}

  if(!itemPermitted()||now<itemState.next)return;itemState.next=now+3000;

  if((!itemState.service||!itemState.filters)&&t.lookup){const l=t.lookup,roots=[];try{const mapType=l.typeObject(api.class_get_type(l.map)),map=invoke(l.find.method,ptr(0),itemArgs([mapType]));if(map.isNull())return;roots.push(hold(map));const container=invoke(l.container.method,map);if(container.isNull())return;roots.push(hold(container));const type=l.typeObject(api.class_get_type(l.contract)),service=invoke(l.resolve.method,container,itemArgs([type]));if(exact(service,classes[ISERVICE])){if(itemState.service)freeHandle(itemState.service);itemState.service=hold(service);

    if(!itemState.filters){const guiType=l.typeObject(api.class_get_type(l.guiContract)),gui=invoke(l.resolve.method,container,itemArgs([guiType]));if(!exact(gui,l.gui))throw Error('item-gui-target');roots.push(hold(gui));l.initClass(l.singleton);const slot=Memory.alloc(8);slot.writePointer(ptr(0));api.field_static_get_value(l.instance,slot);const singleton=slot.readPointer();if(!exact(singleton,l.singleton))throw Error('item-filter-target');roots.push(hold(singleton));const fnType=l.typeObject(l.funcType);roots.push(hold(fnType));const delegates=[];

     for(const [m,k,o]of [[l.usable.method,l.gui,gui],[l.show.method,l.singleton,singleton]]){const reflection=l.reflect(m,k);roots.push(hold(reflection));const fn=invoke(l.createDelegate.method,ptr(0),itemArgs([fnType,o,reflection]));const h=hold(fn);roots.push(h);delegates.push(h);}

     itemState.filters=[delegates[0],delegates[1],null];for(const h of delegates)roots.splice(roots.indexOf(h),1);

    }event(s,'item-bag-ready',{source:'map-container'});}}catch(e){event(s,'item-lookup-error',{reason:String(e)});itemState.next=now+15000;}finally{for(const h of roots)freeHandle(h);}}

  if(!itemState.service||!itemState.filters)return;

  const config=s.itemConfig+':'+s.itemEnabled;if(itemState.config!==config){itemState.config=config;itemState.blocked.clear();}

  const pending=itemState.pending;

  if(pending){if(now>pending.deadline){itemState.blocked.add(pending.id);itemState.pending=null;event(s,'item-transfer-error',{id:pending.id,reason:'Timed out; item paused until settings change'});}else return;}

  const owned=[];const root=o=>{const h=hold(o);owned.push(h);return target(h);};

  try{const service=target(itemState.service),bag=readPtr(service,t.fields.bag);if(!exact(bag,classes[IBAG]))return;

   const filters=itemState.filters?itemState.filters.map(h=>h?target(h):ptr(0)):[ptr(0),ptr(0),ptr(0)];itemState.stage='list';const args=itemArgs([filters[0],itemNumber(0),filters[1],filters[2],ptr(0)]),list=root((()=>{itemState.invoking=true;try{return invoke(t.methods.list.method,service,args);}finally{itemState.invoking=false;}})()),count=itemInt(t.methods.count,list);if(count<0||count>2048)throw Error('item-list-count');let candidate=null;

   for(const row of itemState.rows.values())row.count=0;

   for(let i=0;i<count;i++){itemState.stage='row '+i+'/'+count;const data=root(invoke(t.methods.get.method,list,itemArgs([itemNumber(i)])));if(!exact(data,t.dk))throw Error('item-data-type');const id=readS32(data,t.fields.id),quantity=readS32(data,t.fields.count);const b=Memory.alloc(1);api.field_get_value(data,t.fields.recyclable,b);if(b.readU8()!==1||id<=0||quantity<0||quantity>100000)continue;

    itemState.rows.set(id,{id,name:t.names[id]||('Item '+id),count:quantity});const cap=s.itemRules[id];if(!candidate&&s.itemEnabled&&Number.isInteger(cap)&&quantity>cap&&!itemState.blocked.has(id))candidate={id,cap,data};

   }

   event(s,'item-catalog',{rows:Array.from(itemState.rows.values()).map(r=>r.id+'|'+r.name+'|'+r.count).join('\n')});

   if(!candidate||!s.itemEnabled){itemState.vgpCleanupUntil=0;return;}if(!itemPermitted())return;

   const {id,cap,data}=candidate,current=itemInt(t.methods.quantity,bag,itemArgs([itemNumber(id)]));if(current<=cap||current>100000)return;

   const expiry=root(invoke(t.methods.expiring.method,service));

   itemState.pending={id,amount:current-cap,epoch:s.itemEpoch,bag:bag.toString(),deadline:now+15000};itemState.invoking=true;

   try{invoke(t.methods.recycle.method,bag,itemArgs([data,itemNumber(current-cap),expiry]));event(s,'item-transfer-requested',{id,amount:current-cap,keep:cap});}finally{itemState.invoking=false;}

  }catch(e){if(itemState.pending){itemState.blocked.add(itemState.pending.id);itemState.pending=null;}event(s,'item-transfer-error',{reason:String(e),stage:itemState.stage});itemState.next=now+15000;}finally{for(const h of owned)freeHandle(h);}

 }

 if(p.items){const t=p.items;

  function capture(o,tid){if(s.stopping||api.thread_current().isNull()||!exact(o,classes[ISERVICE]))return;if(itemState.service&&target(itemState.service).equals(o))return;if(itemState.service)freeHandle(itemState.service);itemState.service=hold(o);itemState.next=0;event(s,'item-bag-ready');}

  s.listeners.push(Interceptor.attach(t.methods.init.address,{onEnter(args){this.o=args[0];},onLeave(){try{capture(this.o,this.threadId);}catch(_){}}}));

  s.listeners.push(Interceptor.attach(t.methods.list.address,{onEnter(args){try{capture(args[0],this.threadId);if(!itemState.invoking&&unity(this.threadId)){if(itemState.filters)for(const h of itemState.filters)if(h)freeHandle(h);itemState.filters=[1,3,4].map(i=>args[i].isNull()?null:hold(args[i]));event(s,'item-list-arguments',{nulls:[1,3,4,5].map(i=>args[i].isNull()),predicates:[1,3].map(i=>{if(args[i].isNull())return null;const m=readPtr(args[i],t.fields.delegateMethod),o=readPtr(args[i],t.fields.delegateTarget);return {method:text(api.method_get_name(m)),owner:typeName(api,api.class_get_type(api.method_get_class(m))),target:o.isNull()?null:typeName(api,api.class_get_type(api.object_get_class(o)))};})});}}catch(_){}}}));

  s.listeners.push(Interceptor.attach(t.methods.recycle.address,{onEnter(){if(!itemState.invoking&&unity(this.threadId)){if(itemState.pending)itemState.blocked.add(itemState.pending.id);itemState.pending=null;itemState.next=s.now()+15000;}}}));

  function matched(o){const q=itemState.pending;if(!q||!exact(o,t.cb))return null;const bag=readPtr(o,t.fields.callbackBag);if(bag.toString()!==q.bag)return null;const prediction=readPtr(o,t.fields.prediction);if(prediction.isNull())return null;const proto=invoke(t.fields.proto.method,prediction);if(proto.isNull()||readS32(proto,t.fields.protoId)!==q.id)return null;return q;}

  for(const kind of ['result','error'])s.listeners.push(Interceptor.attach(t.methods[kind].address,{onEnter(args){try{if(!unity(this.threadId))return;this.q=matched(args[0]);if(this.q)this.ok=kind==='result'&&exact(args[1],classes[IRESPONSE])&&readS32(args[1],t.fields.status)===t.success;}catch(_){}},onLeave(){if(!this.q||this.q!==itemState.pending)return;itemState.pending=null;itemState.next=s.now()+1000;if(!this.ok)itemState.blocked.add(this.q.id);event(s,this.ok?'item-transfer-confirmed':'item-transfer-error',{id:this.q.id,amount:this.q.amount,reason:this.ok?'':'Game rejected recycling; item paused until settings change'});}}));

 }

 function clearSpin(){const r=s.spinRecord;if(!r)return;s.spinRecord=null;freeHandle(r.state);if(r.gui)freeHandle(r.gui);}

 function spinPermitted(){return !s.stopping&&s.spinEnabled&&s.now()<s.spinAllowedUntil;}

 function spinBool(m,o){const h=hold(invoke(m.method,o));try{const b=target(h);if(!exact(b,classes[BOOL]))throw Error('spin-bool-type');return api.object_unbox(b).readU8()===1;}finally{freeHandle(h);}}

 function spinTick(now,tid){const r=s.spinRecord,t=p.spin;if(!r||!t)return;

  if(!spinPermitted()||r.epoch!==s.spinEpoch||now>=r.deadline){clearSpin();return;}

  if(s.openerDepth||s.matches<=r.tick)return;

  try{const state=target(r.state),gui=readPtr(state,t.fields.gui);if(gui.isNull())return;

   if(!exact(gui,classes[SPINGUI])||!alive(gui)){clearSpin();return;}

   if(r.gui&&!target(r.gui).equals(gui)){clearSpin();return;}

   const guiState=readS32(gui,fields.currentState);

   if(guiState!==1&&guiState!==STATE_OPEN)return;

   if(r.result!==undefined){if(guiState!==STATE_OPEN||s.matches<=r.resultTick)return;

    if(r.result===t.success){r.closed=true;invoke(t.methods.close.method,gui);event(s,'spin-dismissed',{tid,openedMs:now-r.openedAt});}

    else event(s,'spin-error',{result:r.result,tid});clearSpin();return;

   }

   if(r.sent)return;

   const gesture=readPtr(state,t.fields.gesture);if(!exact(gesture,classes[GESTURE])||!spinBool(t.methods.active,gesture))return;

   const spinner=readPtr(gesture,t.fields.spinner);if(!exact(spinner,classes[SPINNER])||!spinBool(t.methods.can,spinner))return;

   r.sent=true;r.gui=hold(gui);r.deadline=now+12000;

   const speed=Memory.alloc(4);speed.writeFloat(360);const args=Memory.alloc(8);args.writePointer(speed);

   invoke(t.methods.spin.method,spinner,args);

   // Normal threshold callback preserves native one-shot/range gates and result handling.

   invoke(t.methods.request.method,spinner);event(s,'spin-requested',{tid,immediate:true,guiState,openedMs:now-r.openedAt});

  }catch(e){event(s,'spin-error',{reason:String(e),tid});clearSpin();}

 }

 if(p.spin){const t=p.spin;

  s.listeners.push(Interceptor.attach(t.methods.spin.address,{onEnter(args){try{const r=s.spinRecord;if(!unity(this.threadId)||!r||r.sent||!spinPermitted())return;

   const gesture=readPtr(target(r.state),t.fields.gesture);if(exact(gesture,classes[GESTURE])&&readPtr(gesture,t.fields.spinner).equals(args[0])){r.sent=true;r.deadline=s.now()+12000;}

  }catch(_){clearSpin();}}}));

  s.listeners.push(Interceptor.attach(t.methods.enter.address,{onEnter(args){try{if(unity(this.threadId)&&spinPermitted()&&exact(args[0],classes[SPINSTATE])){clearSpin();s.spinRecord={state:hold(args[0]),epoch:s.spinEpoch,deadline:s.now()+15000,openedAt:s.now(),tick:s.matches};}}catch(e){clearSpin();}},onLeave(){if(s.spinRecord)s.spinRecord.tick=s.matches;}}));

  s.listeners.push(Interceptor.attach(t.methods.exit.address,{onEnter(args){if(unity(this.threadId)&&s.spinRecord&&target(s.spinRecord.state).equals(args[0]))clearSpin();}}));

  s.listeners.push(Interceptor.attach(t.methods.result.address,{onEnter(args){try{if(unity(this.threadId)&&exact(args[1],classes[SPINRESULT]))event(s,'cooldown-action',{action:'Pokestop spin'});const r=s.spinRecord;if(unity(this.threadId)&&spinPermitted()&&r&&r.sent&&target(r.state).equals(args[0])&&exact(args[1],classes[SPINRESULT])){this.record=r;this.result=readS32(args[1],t.fields.result);}}catch(_){}},onLeave(){if(this.record&&this.record===s.spinRecord){this.record.result=this.result;this.record.resultTick=s.matches;}}}));

 }



 function transferCatch(r,tid){

  const t=p.transfer;if(!s.transferEnabled||!t)return false;

  const f=t.fields,pk=target(r.pokemon),st=r.vgp?ptr(0):target(r.state),owned=[];

  function root(o){if(o.isNull())throw Error('transfer-missing-record');const h=hold(o);owned.push(h);return target(h);}

  function boolField(o,f){const b=Memory.alloc(1);api.field_get_value(o,f,b);const n=b.readU8();if(n>1)throw Error('transfer-invalid-bool');return n===1;}

  function boxed(m,o,args,bool){const b=root(invoke(m.method,o,args));if(!exact(b,classes[bool?BOOL:INT]))throw Error('transfer-boxed-type');const n=bool?api.object_unbox(b).readU8():api.object_unbox(b).readS32();if(bool&&n>1)throw Error('transfer-boxed-bool');return bool?n===1:n;}

  try{

   const bag=root(r.vgp?target(r.vgpBag):readPtr(st,f.bag));if(!exact(bag,classes[BAG]))throw Error('transfer-bag-type');

   const id=Memory.alloc(8);api.field_get_value(pk,p.details.fields.id,id);const args=Memory.alloc(8);args.writePointer(id);

   const current=invoke(t.methods.get.method,bag,args);

   if(r.transferRequested){

    if(r.transferComplete||r.transferFailed)return false;

    if(!s.transferPending.has(r.capturedKey)){r.transferFailed=true;return false;}

    return !s.dismissEnabled;

   }

   if(r.transferChecked)return false;r.transferChecked=true;

   if(current.isNull()||!exact(current,classes[PK])||capturedKey(current,p.details.fields.id)!==r.capturedKey)throw Error('transfer-bag-identity');

   root(current);

   const display=root(readPtr(current,f.display));if(!exact(display,classes[DISPLAY]))throw Error('transfer-display-type');

   const gm=root(r.vgp?target(r.vgpGm):readPtr(st,f.gm));args.writePointer(gm);

   let size=null;if(s.protect&48){const value=root(invoke(t.methods.size.method,current,args));if(typeName(api,api.class_get_type(api.object_get_class(value)))!=='Holoholo.Rpc.CharacterSize')throw Error('transfer-size-type');size=api.object_unbox(value).readS32();if(!t.sizes.includes(size))throw Error('transfer-unknown-size');}
   const rare=boxed(t.methods.rare,current,args,true),shiny=boxed(t.methods.shiny,current,null,true);

   const origins=root(readPtr(current,f.events));if(!exact(origins,t.eventClass))throw Error('transfer-events-type');const count=boxed(t.methods.eventCount,origins,null,false);if(count<0)throw Error('transfer-event-count');

   const limited=readPtr(current,f.limited); // null or empty string is normal; any nonempty value is protected.

   let limitedEvent=false;if(!limited.isNull()){const len=api.class_get_method_from_name(api.object_get_class(limited),Memory.allocUtf8String('get_Length'),0);if(len.isNull())throw Error('transfer-string-length');limitedEvent=boxed({method:len},limited,null,false)!==0;}

   const v={xxs:size===t.xxs,xxl:size===t.xxl,attack:readS32(current,f.attack),defense:readS32(current,f.defense),stamina:readS32(current,f.stamina),rare,shiny,

    event:count>0||limitedEvent||readS32(display,f.costume)!==t.costumeNone||readS32(display,f.originalCostume)!==t.costumeNone,

    background:!readPtr(display,f.background).isNull()||readS32(display,f.art)!==t.artNone||readS32(display,f.artAsset)!==t.assetNone,

    favorite:boolField(current,f.favorite),egg:boolField(current,f.egg)};

   const reason=transferDecision(v,s.protect);if(reason){r.transferReason=reason;event(s,'transfer-kept',{reason,capturedKey:r.capturedKey,tid});return false;}

   if(s.transferSeen.has(r.capturedKey)||s.transferSeen.size>=4096){event(s,'transfer-kept',{reason:'duplicate-or-session-limit',tid});return false;}

   if(!s.transferEnabled||s.stopping||s.now()>=s.allowedUntil||r.epoch!==s.epoch||(r.vgp?!(s.now()<s.vgpLease&&exact(target(r.response),classes[RESP])&&readS32(target(r.response),fields.status)===p.success&&capturedKey(target(r.response))===r.capturedKey):!detailsValid(r)))return false;

   s.transferSeen.add(r.capturedKey);r.transferRequested=true;r.transferDeadline=s.now()+10000;r.deadline=r.transferDeadline+1000;

   r.transferBag=hold(bag);s.transferPending.set(r.capturedKey,{record:r,epoch:s.epoch,deadline:r.transferDeadline,bag:hold(bag),pokemon:hold(current)});args.writePointer(current);

   const promise=invoke(t.methods.release.method,bag,args);if(promise.isNull())throw Error('transfer-no-promise');r.transferPromise=hold(promise);

   event(s,'transfer-requested',{capturedKey:r.capturedKey,iv:(v.attack+v.defense+v.stamina)/45*100,protect:s.protect,tid});return !s.dismissEnabled;

  }catch(e){if(r.transferRequested)finishTransfer(r.capturedKey,false,String(e));r.transferChecked=true;r.transferFailed=true;event(s,r.transferRequested?'transfer-unconfirmed':'transfer-kept',{reason:String(e),capturedKey:r.capturedKey,tid});return false;}

  finally{for(const h of owned)freeHandle(h);}

 }

 function dismissDetails(r,tid){const gui=target(r.gui);

  if(!alive(gui)||!detailsValid(r)){cancel(r,'details-identity-mismatch');return;}

  const before=readS32(gui,fields.currentState);if(before!==STATE_OPEN){cancel(r,'details-state-not-open:'+before);return;}

  if(s.stopping||r.cancelled||r.epoch!==s.epoch||s.allowedUntil===0||s.now()>=s.allowedUntil||s.openerDepth!==0){cancel(r,'permission-revoked');return;}

  if(transferCatch(r,tid))return;

  // Transfer verification must not veto the user's independent auto-dismiss setting.

  if(!s.dismissEnabled&&!r.transferComplete){cancel(r,'kept-details-open');return;}

  r.invoked=true;s.invoking=true;s.invokingGui=gui;let error=null;

  try{invoke(p.details.methods.click.method,gui);}catch(e){error=String(e);}finally{s.invoking=false;s.invokingGui=null;}

  let after=null,gone=false;try{if(alive(gui))after=readS32(gui,fields.currentState);else gone=true;}catch(_){}

  event(s,'details-dismiss-invoked',{tid,stateBefore:before,stateAfter:after,guiGone:gone,error,advanced:gone||(after!==null&&after!==STATE_OPEN)});

  releaseRecord(r);const i=s.records.indexOf(r);if(i>=0)s.records.splice(i,1);

 }

 if(p.details){const d=p.details,f=d.fields;

  openHook(d.methods.present.address,{

   onEnter(args){for(const r of s.records)if(r.kind==='details')cancel(r,'new-details-presentation');

    if(!exact(args[0],classes[VIEW])||!exact(args[1],classes[PK]))return null;

    const response=readPtr(args[0],f.viewResponse);

    if(!exact(response,classes[RESP])||readS32(response,fields.status)!==p.success||!present(response,fields.caughtId,8)||capturedKey(args[1],f.id)!==capturedKey(response))return null;

    const r={kind:'details',epoch:s.epoch,deadline:s.now()+LIMITS.timeoutMs,readyMatch:null,initDone:false,presentDone:false,openCompleteDone:false,invoked:false,cancelled:null,capturedKey:capturedKey(response)};

    s.records.push(r);r.state=hold(args[0]);r.pokemon=hold(args[1]);r.response=hold(response);if(s.pendingDetails&&target(s.pendingDetails.response).equals(response))releasePendingDetails();detailFrames.push(r);event(s,'details-presentation-observed',{tid:s.thread});return{r};},

   onLeave(payload){payload.r.presentDone=true;},release(payload){const i=detailFrames.lastIndexOf(payload.r);if(i>=0)detailFrames.splice(i,1);}});

  openHook(d.methods.initialize.address,{

   onEnter(args){const old=findByGui(args[0]);if(old)cancel(old,'details-reinitialized');

    if(!exact(args[0],classes[DGUI])||!exact(args[1],classes[DATA]))return null;

    const callback=readPtr(args[1],f.onDismissed);if(!exact(callback,classes[ACTION]))return null;

    const owner=readPtr(callback,f.delegateTarget);

    const r=s.records.find(x=>x.kind==='details'&&!x.cancelled&&!x.gui&&x.state&&target(x.state).equals(owner));if(!r)return null;

    r.gui=hold(args[0]);r.data=hold(args[1]);return{r};},

   onLeave(payload){const r=payload.r,callback=readPtr(target(r.data),f.onDismissed);

    if(callback.isNull()||!readPtr(target(r.gui),f.callback).equals(callback)||!readPtr(target(r.gui),f.data).equals(target(r.data))){cancel(r,'details-not-initialized');return;}

    r.dismissed=hold(callback);r.initDone=true;event(s,'details-initialized',{tid:s.thread});}});

  openHook(d.methods.open.address,{onEnter(args){const r=findByGui(args[0])||recoverDetails(args[0]);return r&&r.kind==='details'?{r}:null;},onLeave(payload){payload.r.openCompleteDone=true;payload.r.readyMatch=null;event(s,'details-open-complete',{tid:s.thread});}});

  s.listeners.push(Interceptor.attach(d.methods.exit.address,{onEnter(args){try{if(!unity(this.threadId))return;for(const r of s.records)if(r.kind==='details'&&r.state&&target(r.state).equals(args[0]))cancel(r,'details-state-exit');}catch(e){fault(s,e);}}}));

  s.listeners.push(Interceptor.attach(d.methods.click.address,{onEnter(args){try{if(!unity(this.threadId)||s.invoking)return;const r=findByGui(args[0]);if(r&&r.kind==='details')cancel(r,'details-user-dismiss');}catch(e){fault(s,e);}}}));

 }

 // ---- Unity-thread filter (tick + thread identity) ----

 const depths=new Map();

 const enter=new NativeCallback(tid=>{if(!s.active)return 0;const depth=depths.get(tid)||0;depths.set(tid,depth+1);return 1;},'int',['uint32']);

 const leave=new NativeCallback(tid=>{if(!s.active)return;const depth=(depths.get(tid)||1)-1;if(depth){depths.set(tid,depth);return;}depths.delete(tid);

  if(s.thread===null)s.thread=tid;else if(s.thread!==tid){fault(s,Error('unity-thread-changed'));return;}

  s.matches++;cleanupTick(tid);},'void',['uint32']);

 if(retainedFilters.length>=16)throw Error('native-filter-session-limit');

 const slot=Memory.alloc(8);slot.writePointer(methods.execute.method);const filter=new CModule(FILTER,{execute_method:slot,enter_match:enter,leave_match:leave});

 retainedFilters.push({filter,slot,enter,leave});const exports=new Set();

 for(const name of['il2cpp_runtime_invoke','il2cpp_runtime_invoke_convert_args']){const address=p.module.findExportByName(name);if(!address||address.isNull()||exports.has(address.toString()))continue;exports.add(address.toString());s.listeners.push(Interceptor.attach(address,{onEnter:filter.on_enter,onLeave:filter.on_leave}));}

 if(!exports.size)throw Error('invocation-filter-unavailable');

 s.ready=true;event(s,'metadata-ready',{fields:p.fieldMeta,successValue:p.success,caughtIdSize:p.caughtIdSize,stateOpen:STATE_OPEN,leaseMs:LIMITS.leaseMs,timeoutMs:LIMITS.timeoutMs,

  covers:p.details?['summary-auto-dismiss','post-catch-stats-details']:['summary-auto-dismiss'],detailsAvailable:!!p.details,detailsError:p.detailsError,transferAvailable:!!p.transfer,transferError:p.transferError,spinAvailable:!!p.spin,spinError:p.spinError,spinCameraAvailable:!!p.spinCamera,spinCameraError:p.spinCameraError,itemLookupAvailable:!!(p.items&&p.items.lookup),itemsAvailable:!!p.items,itemsError:p.itemsError,rocketAvailable:!!p.rocket,rocketError:p.rocketError,berriesAvailable:!!p.berries,berriesError:p.berriesError,battlesAvailable:!!p.battles,battlesError:p.battlesError,notCovered:['new-species-cutscene','new-form-cutscene','xp-toast-presentation']});

}

function start(options){

 if(!options||options.enabled!==true)return Promise.resolve({status:'disabled'});if(running)return Promise.resolve({status:'already-running'});

 let resolve;const promise=new Promise(r=>resolve=r);const s={promise,resolve,onEvent:options.onEvent,active:true,ready:false,stopping:false,reason:null,listeners:[],queue:[],records:[],pendingDetails:null,transferEnabled:false,protect:63,dismissEnabled:true,transferSeen:new Set(),transferPending:new Map(),itemRules:{},itemConfig:'',itemEnabled:false,itemLease:0,itemEpoch:0,spinRecord:null,spinEnabled:false,spinAllowedUntil:0,spinEpoch:0,nativeMask:0,nativeBalls:1,nativeBerry:0,nativeCurve:true,nativeGrade:3,nativeScreenFree:false,nativeLat:0,nativeLon:0,nativeLease:0,gymFeedEnabled:false,gymFeedBerry:0,gymFeedLat:0,gymFeedLon:0,gymFeedLease:0,researchClaim:false,researchRules:'',researchLease:0,ownedHandles:new Set(),openerDepth:0,invoking:false,invokingGui:null,allowedUntil:0,epoch:0,thread:null,matches:0,busy:false,retries:0,timer:null,clockReady:false,cleanupReported:false,now:()=>0};running=s;

 function finish(){for(const h of s.listeners)try{h.detach();}catch(_){}s.listeners=[];s.active=false;const result={status:s.reason?'unavailable':'cancelled'};if(s.reason)result.reason=s.reason;event(s,'finished',result);flush(s);if(running===s)running=null;s.resolve(result);}

 function poll(){s.timer=null;if(!s.active)return;

  try{

   if(!s.ready&&!s.stopping){if(Process.arch!=='arm64'||Process.pointerSize!==8)throw Error('unsupported-architecture');

    if(!s.clockReady){s.now=clock();s.clockReady=true;}

    const module=Process.findModuleByName('libil2cpp.so');if(module){const api=bind(module),domain=api.domain_get();if(!domain.isNull()){const prep=prepare(module,api,domain);if(prep)install(s,prep);}}

    if(!s.ready)s.retries++; /* Wait for game metadata during slow cold starts. */}

   if(s.stopping&&s.ownedHandles.size&&!s.cleanupReported){s.cleanupReported=true;event(s,'cleanup-pending',{reason:s.reason||'stop',pending:true});}

   flush(s);

   // Owned records, like quick-ball attempts, wait for a Unity-thread release.

   if(s.stopping&&s.records.length===0&&s.ownedHandles.size===0&&s.openerDepth===0&&!s.busy){finish();return;}

  }catch(e){fault(s,e);}

  s.timer=setTimeout(poll,s.ready?LIMITS.pollMs:1000);}

 s.timer=setTimeout(poll,0);return promise;}

function setAllowed(value){const s=running;if(!s||!s.active||!s.ready||s.stopping)return false;try{const now=s.now();if(value!==true||now>=s.allowedUntil)s.epoch++;s.allowedUntil=value===true?now+LIMITS.leaseMs:0;return value===true;}catch(e){fault(s,e);return false;}}

function setSpinAllowed(value){const s=running;if(!s||!s.active||!s.ready||s.stopping)return false;const now=s.now(),enabled=value===true;if(s.spinEnabled!==enabled||now>=s.spinAllowedUntil)s.spinEpoch++;s.spinEnabled=enabled;s.spinAllowedUntil=enabled?now+LIMITS.leaseMs:0;return enabled;}

function setSpawnOptions(enabled,allowed){const s=running;if(!s||!s.ready||s.stopping)return false;s.spawnEnabled=enabled===true;s.spawnLease=allowed===true?s.now()+LIMITS.leaseMs:0;return s.spawnEnabled;}

function setMapPoiAllowed(allowed){const s=running;if(!s||!s.active||s.stopping)return false;s.mapPoiLease=allowed===true?s.now()+2500:0;return true;}
function setVgpOptions(mask,allowed,lat,lon){const s=running;if(!s||!s.active||s.stopping)return false;s.vgpMask=(mask|0)&3;s.vgpLat=lat;s.vgpLon=lon;s.vgpLease=allowed===true&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?s.now()+2500:0;return true;}

function setIncubatorOptions(enabled,longest,allowed){const s=running;if(!s||!s.active||s.stopping)return false;s.incubatorEnabled=enabled===true;s.incubatorLongest=longest===true;s.incubatorLease=allowed===true?s.now()+2500:0;return !!s.incubatorEnabled;}

function setBuddyOptions(berry,allowed){const s=running;if(!s||!s.active||s.stopping)return false;const next=[701,703,705,706,707].includes(berry)?berry:0;s.buddyBerry=next;s.buddyLease=allowed===true?s.now()+2500:0;return true;}

function setGiftOptions(mask,allowed){const s=running;if(!s||!s.ready||s.stopping)return false;s.giftMask=Number.isInteger(mask)&&mask>=0&&mask<=7?mask:0;s.giftLease=allowed===true?s.now()+LIMITS.leaseMs:0;const key=s.giftMask+':'+(allowed===true);if(s.giftPermission!==key){s.giftPermission=key;event(s,'gift-permission',{mask:s.giftMask,allowed:allowed===true});}return !!(s.giftMask&3);}

function setBerryImpactReady(){const s=running;if(s&&!s.stopping)s.berryImpactReady=true;}

function setBerryOptions(id,allowed){const s=running;if(!s||!s.ready||s.stopping)return false;s.berryId=[701,703,705,706,707].includes(id)?id:0;s.berryLease=allowed===true?s.now()+LIMITS.leaseMs:0;return s.berryId>0;}

function setBattleOptions(mask,allowed){const s=running;if(!s||!s.ready||s.stopping)return false;s.battleMask=Number.isInteger(mask)&&mask>=0&&mask<=1023?mask:0;s.battleLease=allowed===true?s.now()+LIMITS.leaseMs:0;return s.battleMask>0;}

function setRocketOptions(mask,allowed){const s=running;if(!s||!s.ready||s.stopping)return false;s.rocketMask=Number.isInteger(mask)&&mask>=0&&mask<=7?mask:0;s.rocketLease=allowed===true?s.now()+LIMITS.leaseMs:0;return s.rocketMask>0;}

function setItemOptions(enabled,rules,allowed){const s=running;if(!s||!s.ready||s.stopping)return false;const parsed={};let valid=true;

 for(const part of String(rules||'').split(';')){if(!part)continue;const match=/^(\d{1,7}):(\d{1,6})$/.exec(part);if(!match||+match[1]<=0||+match[2]>100000||Object.prototype.hasOwnProperty.call(parsed,match[1])){valid=false;break;}parsed[match[1]]=+match[2];}

 const config=valid?JSON.stringify(parsed):'{}',on=enabled===true&&valid;if(s.itemConfig!==config||s.itemEnabled!==on||allowed!==true||s.now()>=s.itemLease)s.itemEpoch++;s.itemRules=valid?parsed:{};s.itemConfig=config;s.itemEnabled=on;s.itemLease=allowed===true?s.now()+LIMITS.leaseMs:0;return on;

}

function stop(){const s=running;if(!s)return Promise.resolve({status:'idle'});s.allowedUntil=0;s.stopping=true;return s.promise;}

function setTransferOptions(enabled,protect,dismiss){const s=running;if(!s||!s.active||s.stopping)return false;

 const next=enabled===true,mask=Number.isInteger(protect)&&protect>=0&&protect<=63?protect:63;

 if(s.transferEnabled!==next||s.protect!==mask)s.epoch++;

 s.transferEnabled=next;s.protect=mask;s.dismissEnabled=dismiss===true;return true;}

function setAutoCatchOptions(mask,allowed,balls,berry,curve,grade,screenFree,lat,lon){
 const s=running;if(!s||!s.ready||s.stopping)return false;
 const previousMask=s.nativeMask,previousBalls=s.nativeBalls,previousLease=s.nativeLease>s.now();
 s.nativeMask=Number.isInteger(mask)?mask&3:0;
 s.nativeBalls=Number.isInteger(balls)&&balls>=1&&balls<=7?balls:1;
 s.nativeBerry=[0,701,703,705,706,707].includes(berry)?berry:0;
 s.nativeCurve=curve===true;
 s.nativeGrade=Number.isInteger(grade)&&grade>=0&&grade<=3?grade:0;
 s.nativeScreenFree=screenFree===true;
 s.nativeLat=Number.isFinite(lat)&&Math.abs(lat)<=90?lat:0;
 s.nativeLon=Number.isFinite(lon)&&Math.abs(lon)<=180?lon:0;
 s.nativeLease=allowed===true&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?s.now()+LIMITS.leaseMs:0;
 if(s.nativeState&&(s.nativeMask!==previousMask||s.nativeBalls!==previousBalls||(allowed===true&&!previousLease))){s.nativeState.blocked=false;s.nativeState.next=0;}
 return s.nativeMask!==0;
}

function setGymFeedOptions(enabled,berry,allowed,lat,lon){
 const s=running;if(!s||!s.ready||s.stopping)return false;
 const previousEnabled=s.gymFeedEnabled,previousLease=s.gymFeedLease>s.now();
 s.gymFeedEnabled=enabled===true;
 s.gymFeedBerry=[0,701,703,705,706,707].includes(berry)?berry:0;
 s.gymFeedLat=Number.isFinite(lat)&&Math.abs(lat)<=90?lat:0;
 s.gymFeedLon=Number.isFinite(lon)&&Math.abs(lon)<=180?lon:0;
 s.gymFeedLease=allowed===true&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?s.now()+LIMITS.leaseMs:0;
 if(s.gymFeedState&&(s.gymFeedEnabled!==previousEnabled||(allowed===true&&!previousLease)))s.gymFeedState.next=0;
 return s.gymFeedEnabled;
}

function setResearchOptions(claim,rules,allowed){
 const s=running;if(!s||!s.ready||s.stopping)return false;
 const previousActive=s.researchClaim||String(s.researchRules||'').trim()!=='',previousLease=s.researchLease>s.now(),previousClaim=s.researchClaim,previousRules=String(s.researchRules||'');
 s.researchClaim=claim===true;
 s.researchRules=String(rules==null?'':rules);
 s.researchLease=allowed===true?s.now()+LIMITS.leaseMs:0;
 const active=s.researchClaim||s.researchRules.trim()!=='';
 if(s.researchState&&(active!==previousActive||s.researchClaim!==previousClaim||s.researchRules!==previousRules||(allowed===true&&!previousLease))){s.researchState.blocked=false;s.researchState.next=0;}
 return active;
}

const api=Object.freeze({start,setIncubatorOptions,setMapPoiAllowed,setVgpOptions,setAutoCatchOptions,setGymFeedOptions,setResearchOptions,setAllowed,setSpinAllowed,setTransferOptions,setItemOptions,setRocketOptions,setBattleOptions,setBerryOptions,setBerryImpactReady,setSpawnOptions,setGiftOptions,setBuddyOptions,transferDecision,stop});root.PGRazorQuickClose=api;return api;

})(globalThis);
