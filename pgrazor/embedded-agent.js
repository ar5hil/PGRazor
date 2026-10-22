// Frida Gadget script-mode entry: runs wholly inside the packaged application.
// No listening socket, desktop controller, root command, or mock-flag hooks.
let bootParameters = {}, control = null, timer = null;
let diagnosticTimer = null, diagnostic = null, disposed = false;
let diagnosticRunning = false, cameraReading = '', lastHeadingLog = 0;
let interactionTimer = null, interaction = null, interactionRunning = false;
let quickSummaryTimer = null, quickSummary = null;
let quickSummaryFailed = false, quickSummaryStop = null;
const summaryLifecycleHooks = [];
let quickSummaryNativeReady=false, quickBallNativeReady=false;
let quickBallTimer = null, quickBall = null, quickBallFailed = false, quickBallStop = null;
const ballLifecycleHooks = [];
const hooks = [];
function bootLog(text) {
    const line = new Date().toISOString() + ' ' + text;
    console.log(line);
    try {
        if (bootParameters.startupLog) {
            const file = new File(bootParameters.startupLog, 'a');
            try { file.write(line + '\n'); file.flush(); } finally { file.close(); }
        }
    } catch (_) {}
}
function rollback() {
    for (const method of hooks) method.implementation = null;
    hooks.length = 0;
}
function finishDiagnostic() {
    diagnosticRunning = false;
    if (!disposed && control && bootParameters.cameraSteering === true) {
        try { Java.performNow(() => control.invalidateCameraHeading('Camera reader stopped')); }
        catch (error) { bootLog('camera-status-error: ' + error); }
    }
    if (!disposed && control && bootParameters.cameraSample === true) {
        try { Java.performNow(() => control.setCameraDiagnosticRunning(false)); }
        catch (error) { bootLog('camera-status-error: ' + error); }
    }
}
function runDiagnostic() {
    const path = bootParameters.sceneProbePath || bootParameters.cameraProbePath || bootParameters.surveyPath;
    if (!path || disposed || diagnosticRunning) return;
    const kind = bootParameters.sceneProbePath ? 'scene-probe' : bootParameters.cameraProbePath ? 'camera-probe' : 'il2cpp-survey';
    diagnosticRunning = true;
    cameraReading = '';
        try {
            if (bootParameters.cameraSample === true) Java.performNow(() => {
                control.setCameraDiagnosticRunning(true);
                control.cameraDiagnostic('Checking camera thread...');
            });
            if (diagnostic === null)
                diagnostic = Script.evaluate('/pgrazor-' + kind + '.js', File.readAllText(path));
            const result = diagnostic.start({ enabled: true,
                observeRuntime: bootParameters.sceneObserve === true,
                sampleCamera: bootParameters.cameraSample === true || bootParameters.cameraSteering === true,
                continuous: bootParameters.cameraSteering === true,
                shouldSample() {
                    if (disposed || bootParameters.cameraSteering !== true) return false;
                    let requested = false;
                    Java.performNow(() => { requested = control.cameraSteeringRequested() || control.buddySamplingRequested(); });
                    return requested;
                }, onEvent(event) {
                if (disposed) return;
                Java.performNow(() => {
                    if (bootParameters.cameraSteering === true && event.kind === 'camera-sample') {
                        if (!Number.isFinite(event.yawDegrees) || !Number.isInteger(event.cameraId) ||
                            event.cameraId === 0 || !Number.isFinite(event.timeMs) || event.timeMs < 0) {
                            control.invalidateCameraHeading('Invalid camera reading');
                            return;
                        }
                        control.updateCameraHeadingAt(event.yawDegrees, event.cameraId, event.mapVisible === true,
                            Math.floor(event.timeMs));
                        if (event.timeMs - lastHeadingLog >= 1000) {
                            lastHeadingLog = event.timeMs;
                            control.event('camera-heading', JSON.stringify(event));
                        }
                    } else {
                        if (bootParameters.cameraSteering === true && event.kind === 'camera-unavailable')
                            control.invalidateCameraHeading('Camera unavailable');
                        control.event(kind, JSON.stringify(event));
                    }
                    if (bootParameters.cameraSample !== true) return;
                    if (event.kind === 'camera-sample') {
                        cameraReading = 'Camera yaw (world): ' + Number(event.yawDegrees).toFixed(1) +
                            '\u00b0\nCamera ' + event.cameraId + ' \u00b7 sample ' + event.sampleIndex;
                        control.cameraDiagnostic(cameraReading);
                    } else if (event.kind === 'finished') {
                        control.cameraDiagnostic((cameraReading ? cameraReading + '\n' : '') +
                            'Diagnostic ' + event.status + (event.reason ? ': ' + event.reason : '') +
                            (event.message ? ': ' + event.message : ''));
                    }
                });
            }});
            Promise.resolve(result).then(finishDiagnostic, error => {
                finishDiagnostic();
                bootLog(kind + '-error: ' + error);
                if (!disposed && bootParameters.cameraSample === true)
                    Java.performNow(() => control.cameraDiagnostic('Camera diagnostic error: ' + error));
            });
        } catch (error) {
            finishDiagnostic();
            bootLog(kind + '-error: ' + error);
            Java.performNow(() => {
                control.event(kind + '-error', String(error));
                if (bootParameters.cameraSample === true) control.cameraDiagnostic('Camera diagnostic error: ' + error);
            });
        }
}
function scheduleDiagnostic() {
    if (!bootParameters.cameraProbePath && !bootParameters.surveyPath && !bootParameters.sceneProbePath) return;
    const kind = bootParameters.sceneProbePath ? 'scene-probe' : bootParameters.cameraProbePath ? 'camera-probe' : 'il2cpp-survey';
    control.event(kind + '-scheduled', bootParameters.cameraSteering === true ?
        'Camera steering reader starts after a 1.5 second startup grace' : 'Opt-in diagnostic starts in 20 seconds');
    diagnosticTimer = setTimeout(() => {
        diagnosticTimer = null;
        runDiagnostic();
    }, bootParameters.cameraSteering === true ? 1500 : 20000);
}
function finishInteraction(result, observe) {
    interactionRunning = false;
    if (disposed || !control) return;
    Java.performNow(() => {
        control.setInteractionDiagnosticRunning(false);
        const status=result && result.status || 'complete';
        const detail=result && (result.reason || result.message);
        control.interactionDiagnostic(observe ? 'Capture '+status+'; see Run log'+(detail?': '+detail:'') :
            (status==='complete' ? 'Ready to record catch and spin callbacks' : 'Metadata '+status+(detail?': '+detail:'')));
    });
}
function runInteraction(observe) {
    if (disposed || interactionRunning || !bootParameters.interactionProbePath || bootParameters.interactionProbe !== true) return;
    try {
        let ready=false;
        Java.performNow(() => { ready=control.interactionDiagnosticsReady(); });
        if (!ready) return;
        interactionRunning=true;
        Java.performNow(() => {
            control.setInteractionDiagnosticRunning(true);
            control.interactionDiagnostic(observe ? 'Preparing catch/spin capture...' : 'Checking catch/spin metadata...');
        });
        if (interaction === null) interaction=Script.evaluate('/pgrazor-interaction-probe.js',File.readAllText(bootParameters.interactionProbePath));
        const result=interaction.start({enabled:true,observeRuntime:observe,readResults:observe,onEvent(event) {
            if (disposed) return;
            Java.performNow(() => {
                control.event('interaction-probe',JSON.stringify(event));
                if (event.kind==='observation-ready') control.interactionDiagnostic('Recording for 60s: catch normally, then spin a stop. Minimize this panel.');
            });
        }});
        Promise.resolve(result).then(value=>finishInteraction(value,observe),error=>{
            bootLog('interaction-probe-error: '+error);finishInteraction({status:'error',message:String(error)},observe);
        });
    } catch (error) {
        bootLog('interaction-probe-error: '+error);
        finishInteraction({status:'error',message:String(error)},observe);
    }
}
function stopInteraction() {
    if (interactionTimer!==null) { clearTimeout(interactionTimer);interactionTimer=null; }
    if (interaction===null || !interactionRunning) return;
    try { return interaction.stop(); }
    catch (error) { bootLog('interaction-stop-error: '+error);finishInteraction({status:'error',message:String(error)},true); }
}
function scheduleInteraction() {
    if (bootParameters.interactionProbe !== true || !bootParameters.interactionProbePath) return;
    control.event('interaction-probe-scheduled','Metadata check in 25 seconds; event capture requires an explicit button press');
    interactionTimer=setTimeout(()=>{interactionTimer=null;runInteraction(false);},25000);
}
function summaryUnavailable(reason) {
    if (disposed || !control) return;
    try { Java.performNow(() => control.setQuickSummaryReady(false, 'Unavailable: '+String(reason).slice(0,180))); }
    catch (error) { bootLog('quick-summary-status-error: '+error); }
}
function restoreSummaryLifecycleHooks() {
    for (const method of summaryLifecycleHooks) {
        try { method.implementation = null; }
        catch (error) { bootLog('quick-summary-unhook-error: '+error); }
    }
    summaryLifecycleHooks.length = 0;
}
function requestSummaryStop() {
    if (!quickSummary || quickSummaryStop) return quickSummaryStop;
    // Revocation failure, terminal failure and disposal share one cleanup.
    // Disposal still receives a rejection; background callers leave none unobserved.
    try { quickSummaryStop = Promise.resolve(quickSummary.stop()); }
    catch (error) { quickSummaryStop = Promise.reject(error); }
    quickSummaryStop.catch(error => bootLog('quick-summary-cleanup-error: '+error));
    return quickSummaryStop;
}
function failQuickSummary(reason) {
    // Latch before revocation, cleanup or status callbacks can re-enter the lifecycle hooks.
    quickSummaryFailed = true;
    if (quickSummary && !quickSummaryStop) {
        try { quickSummary.setAllowed(false);if(quickSummary.setSpinAllowed)quickSummary.setSpinAllowed(false);if(quickSummary.setItemOptions)quickSummary.setItemOptions(false,"",false);if(quickSummary.setRocketOptions)quickSummary.setRocketOptions(0,false);if(quickSummary.setBattleOptions)quickSummary.setBattleOptions(0,false);if(quickSummary.setVgpOptions)quickSummary.setVgpOptions(0,false,0,0);if(quickSummary.setBuddyOptions)quickSummary.setBuddyOptions(0,false);if(quickSummary.setIncubatorOptions)quickSummary.setIncubatorOptions(false,false,false);if(quickSummary.setGiftOptions)quickSummary.setGiftOptions(0,false);if(quickSummary.setBerryImpactReady&&(quickBallNativeReady||bootParameters.quickBall!==true))quickSummary.setBerryImpactReady();
                if(quickSummary.setBerryOptions)quickSummary.setBerryOptions(0,false);if(quickSummary.setSpawnOptions)quickSummary.setSpawnOptions(false,false);if(quickSummary.setAutoCatchOptions)quickSummary.setAutoCatchOptions(0,false,1,0,true,3,false,0,0);if(quickSummary.setGymFeedOptions)quickSummary.setGymFeedOptions(false,0,false,0,0);if(quickSummary.setResearchOptions)quickSummary.setResearchOptions(false,"",false); }
        catch (error) { bootLog('quick-summary-revoke-error: '+error); }
    }
    requestSummaryStop();
    summaryUnavailable(reason);
}
function revokeQuickSummary() {
    if (!quickSummary || quickSummaryFailed) return;
    try { quickSummary.setAllowed(false);if(quickSummary.setSpinAllowed)quickSummary.setSpinAllowed(false);if(quickSummary.setItemOptions)quickSummary.setItemOptions(false,"",false);if(quickSummary.setRocketOptions)quickSummary.setRocketOptions(0,false);if(quickSummary.setBattleOptions)quickSummary.setBattleOptions(0,false);if(quickSummary.setVgpOptions)quickSummary.setVgpOptions(0,false,0,0);if(quickSummary.setBuddyOptions)quickSummary.setBuddyOptions(0,false);if(quickSummary.setIncubatorOptions)quickSummary.setIncubatorOptions(false,false,false);if(quickSummary.setGiftOptions)quickSummary.setGiftOptions(0,false);if(quickSummary.setBerryImpactReady&&(quickBallNativeReady||bootParameters.quickBall!==true))quickSummary.setBerryImpactReady();
                if(quickSummary.setBerryOptions)quickSummary.setBerryOptions(0,false);if(quickSummary.setSpawnOptions)quickSummary.setSpawnOptions(false,false);if(quickSummary.setAutoCatchOptions)quickSummary.setAutoCatchOptions(0,false,1,0,true,3,false,0,0);if(quickSummary.setGymFeedOptions)quickSummary.setGymFeedOptions(false,0,false,0,0);if(quickSummary.setResearchOptions)quickSummary.setResearchOptions(false,"",false); }
    catch (error) {
        // Keep a failed optional feature from affecting the original Java lifecycle.
        quickSummaryFailed = true;
        bootLog('quick-summary-revoke-error: '+error);
        requestSummaryStop();
    }
}
function installSummaryLifecycleHooks() {
    const methods = [
        [control.setQuickSummaryEnabled.overload('boolean'), false],
        ...(control.saveItemRules ? [[control.saveItemRules.overload('boolean','java.lang.String','java.lang.String'),true]] : []),
        ...(control.setQuickSpinEnabled ? [[control.setQuickSpinEnabled.overload('boolean'),true]] : []),
        ...(control.setAutoTransferEnabled ? [[control.setAutoTransferEnabled.overload('boolean'),true],[control.setTransferProtect.overload('int'),true]] : []),
        [control.setQuickSummaryReady.overload('boolean', 'java.lang.String'), false],
        [control.suspendForBackground.overload(), true],
        [control.disconnect.overload(), true]
    ];
    for (const [method, always] of methods) {
        // Include even a partially installed method in rollback if installation throws.
        summaryLifecycleHooks.push(method);
        method.implementation = function (...args) {
            if (always || args[0] === false) revokeQuickSummary();
            if (always) revokeQuickBall();
            return method.call(this, ...args);
        };
    }
}
function scheduleQuickSummary() {
    if (bootParameters.quickSummary !== true || !bootParameters.quickSummaryPath) return;
    try {
        control.configureQuickSummary(true);
        installSummaryLifecycleHooks();
    } catch (error) {
        quickSummaryFailed = true;
        restoreSummaryLifecycleHooks();
        bootLog('quick-summary-lifecycle-error: '+error);
        try { summaryUnavailable(error); } catch (statusError) { bootLog('quick-summary-status-error: '+statusError); }
        return;
    }
    quickSummaryTimer=setTimeout(()=>{
        quickSummaryTimer=null;
        if (disposed || quickSummaryFailed) return;
        try {
            quickSummary=Script.evaluate(bootParameters.quickClose===true?'/pgrazor-quick-close.js':'/pgrazor-quick-summary.js',File.readAllText(bootParameters.quickSummaryPath));
            const result=quickSummary.start({enabled:true,onEvent(event) {
                if (disposed || quickSummaryFailed) return;
                try { Java.performNow(()=>{
                    control.event(bootParameters.quickClose===true?'quick-close':'quick-summary',JSON.stringify(event));
                    if(event.kind==='cooldown-action')control.cooldownAction(event.action);
                    if(event.kind==='cooldown-encounter')control.setCooldownEncounter(event.source);
                    if (event.kind==='metadata-ready') quickSummaryNativeReady=true;
                    if (event.kind==='metadata-ready') control.setQuickSummaryReady(bootParameters.quickClose===true,
                        bootParameters.quickClose===true?'Ready: summary auto-dismiss; other screens remain':'Catch normally once to validate the summary wait');
                    if (event.kind==='metadata-ready' && control.setAutoTransferReady)control.setAutoTransferReady(!!event.transferAvailable,event.transferAvailable?'Ready: new catches only; IV below 90%':'Unavailable: '+(event.transferError||'transfer support not bundled'));
                    if(control.transferResult && event.kind==='transfer-requested')control.transferResult('Transfer requested; waiting for bag update');
                    if(event.kind==='transfer-confirmed'){if(control.transferResult)control.transferResult('Transferred newly caught Pokemon');try{control.quickBallOutcome('transferred');}catch(error){bootLog('transfer-toast-error: '+error);}}
                    if(event.kind==='transfer-error'){if(control.transferResult)control.transferResult('Transfer Error: '+event.reason);try{control.quickBallOutcome('transfer-error');}catch(error){bootLog('transfer-toast-error: '+error);}}
                    if(event.kind==='metadata-ready'&&control.setItemReady)control.setItemReady(!!event.itemsAvailable,event.itemsAvailable?'Waiting for item bag':'Unavailable: '+event.itemsError);
                    if(event.kind==='metadata-ready'&&control.setRocketReady)control.setRocketReady(!!event.rocketAvailable,event.rocketAvailable?'Ready: Team Rocket battles':'Unavailable: '+event.rocketError);
                    // Gift readiness must reach Control before the heartbeat can grant its lease.
                    if(event.kind==='encounter-berry')control.setEncounterBerry(!!event.active,!!event.busy);
                    if(event.kind==='map-pois')control.setMapPoiSnapshot(JSON.stringify(event));
                    if(event.kind==='vgp-ready')control.setVgpReady(!!event.available,event.available?'Ready':'Unavailable: '+event.reason);
                    if(event.kind==='vgp-marker')control.setVgpTarget(!!event.visible,event.x||0,event.y||0,event.action==='spin');
                    if(event.kind==='vgp-status')control.setVgpStatus(event.message);
                    if(event.kind==='vgp-result')control.vgpResult(event.action,!!event.success);
                    if(event.kind==='native-ready'&&control.setNativeReady)control.setNativeReady(!!event.available,event.available?(event.screen?'Ready: Rasiel native engine':'Ready: direct throws (screen support unavailable)'):'Unavailable: '+(event.reason||'native engine not bundled'));
                    if(event.kind==='native-status'&&control.setNativeStatus)control.setNativeStatus(event.message);
                    if(event.kind==='gymfeed-ready'&&control.setGymFeedReady)control.setGymFeedReady(!!event.available,event.available?'Ready: feed gym defenders':'Unavailable: '+(event.reason||'gym feed not bundled'));
                    if(event.kind==='gymfeed-status'&&control.setGymFeedStatus)control.setGymFeedStatus(event.message);
                    if(event.kind==='research-ready'&&control.setResearchReady)control.setResearchReady(!!event.available,event.available?'Ready: field research':'Unavailable: '+(event.reason||'research support not bundled'));
                    if(event.kind==='research-status'&&control.setResearchStatus)control.setResearchStatus(event.message);
                    if(event.kind==='buddy-ready')control.setBuddyReady(!!event.available,event.available?'Ready: choose a berry':'Unavailable: '+event.reason);
                    if(event.kind==='buddy-status')control.setBuddyStatus(event.message);
                    if(event.kind==='incubator-ready')control.setIncubatorReady(!!event.available,event.available?'Ready':'Unavailable: '+event.reason);
                    if(event.kind==='incubator-status')control.setIncubatorStatus(event.message);
                    if(event.kind==='gift-ready')control.setGiftsReady(!!event.available,event.available?'Ready: tap a friend with a gift':'Unavailable: '+event.reason);
                    if(event.kind==='gift-status')control.setGiftStatus(event.message);
                    if(event.kind==='gift-wait')control.setGiftStatus(event.reason);
                    if(event.kind==='gift-error')control.setGiftStatus('Gift automation paused: '+event.reason);
                    if(event.kind==='spawn-ready')control.setSpawnReady(!!event.available);
                    if(event.kind==='spawn-range')control.setSpawnRange(event.original,event.effective);
                    if(event.kind==='metadata-ready')control.setBerryReady(!!event.berriesAvailable);
                    if(event.kind==='metadata-ready'&&control.setBattlesReady)control.setBattlesReady(!!event.battlesAvailable,event.battlesAvailable?'Ready: raids, gyms and Dynamax':'Unavailable: '+event.battlesError);
                    if(event.kind==='battle-scope'&&control.setBattleStatus)control.setBattleStatus(event.active?['Raid battle detected','Gym battle detected','Dynamax battle detected'][event.mode]:'Ready: raids, gyms and Dynamax');
                    if(event.kind==='battle-error'&&control.setBattleStatus)control.setBattleStatus('Battle automation paused: '+event.reason);
                    if(event.kind==='rocket-scope'&&control.setRocketStatus)control.setRocketStatus(event.active?'Team Rocket battle detected':'Ready: Team Rocket battles');
                    if(event.kind==='rocket-error'&&control.setRocketStatus)control.setRocketStatus('Battle automation paused: '+event.reason);
                    if(event.kind==='item-catalog'&&control.setItemCatalog)control.setItemCatalog(event.rows);
                    if(event.kind==='item-transfer-confirmed'&&control.setItemStatus)control.setItemStatus('Transferred '+event.amount+' items');
                    if(event.kind==='item-transfer-error'&&control.setItemStatus)control.setItemStatus('Item transfer: '+event.reason);
                    if(event.kind==='metadata-ready'&&control.setQuickSpinReady)control.setQuickSpinReady(!!event.spinAvailable,event.spinAvailable?'Ready: open a PokeStop':'Unavailable: '+event.spinError);
                    if(control.transferResult && event.kind==='transfer-kept')control.transferResult('Kept: '+event.reason);
                    if(control.transferResult && event.kind==='transfer-unconfirmed')control.transferResult('Transfer result unconfirmed; no automatic retry');
                    if (event.kind==='baseline-ready' && bootParameters.quickClose!==true) control.setQuickSummaryReady(true,'Validated. Enable to shorten the next post-catch wait');
                }); } catch (error) { bootLog('quick-summary-event-error: '+error);failQuickSummary(error); }
            }});
            // A settled module is terminal; a late event or heartbeat must not grant it again.
            Promise.resolve(result).then(value=>failQuickSummary(value && (value.reason || value.status) || 'Stopped'),
                error=>{bootLog('quick-summary-error: '+error);failQuickSummary(error);});
        } catch (error) { bootLog('quick-summary-error: '+error);failQuickSummary(error); }
    },1500);
}
function stopQuickSummary() {
    if (quickSummaryTimer!==null) {clearTimeout(quickSummaryTimer);quickSummaryTimer=null;}
    if (!quickSummary) return;
    revokeQuickSummary();
    return requestSummaryStop();
}
function ballUnavailable(reason) {
    if (disposed || !control) return;
    try { Java.performNow(() => control.setQuickBallReady(false,'Unavailable: '+String(reason).slice(0,180))); }
    catch (error) { bootLog('quick-ball-status-error: '+error); }
}
function restoreBallLifecycleHooks() {
    for (const method of ballLifecycleHooks) {
        try { method.implementation=null; } catch(error) { bootLog('quick-ball-unhook-error: '+error); }
    }
    ballLifecycleHooks.length=0;
}
function requestBallStop() {
    if (!quickBall || quickBallStop) return quickBallStop;
    try {
        // Native cleanup may wait for a Unity frame after the app resumes.
        quickBallStop=Promise.resolve(quickBall.stop());
        quickBallStop.catch(error => bootLog('quick-ball-cleanup-error: '+error));
        return quickBallStop;
    } catch(error) { bootLog('quick-ball-stop-error: '+error); throw error; }
}
function revokeQuickBall() {
    if (!quickBall || quickBallFailed) return;
    try { quickBall.setAllowed(false); if(quickBall.setMapTapOptions)quickBall.setMapTapOptions(0,0,false); if(quickBall.setThrowOptions)quickBall.setThrowOptions(0,false,false); if(quickBall.setArThrowOptions)quickBall.setArThrowOptions(false,false); }
    catch(error) {
        quickBallFailed=true;bootLog('quick-ball-revoke-error: '+error);
        try { requestBallStop(); } catch(_) {}
        ballUnavailable(error);
    }
}
function scheduleQuickBall() {
    if (bootParameters.quickBall!==true || !bootParameters.quickBallPath) return;
    try {
        control.configureQuickBall(true);
        const methods=[
            [control.setQuickBallEnabled.overload('boolean'),false],
            [control.setQuickBallReady.overload('boolean','java.lang.String'),false],
            [control.setMapTapMode.overload('int'),true],[control.setThrowGrade.overload('int'),true],[control.setThrowCurve.overload('boolean'),true]
        ];
        // Summary already owns shared lifecycle hooks when both are bundled.
        // Its shared callbacks revoke both features without replacing each other.
        if (!summaryLifecycleHooks.length) methods.push(
            [control.suspendForBackground.overload(),true],[control.disconnect.overload(),true]);
        for (const [method,always] of methods) {
            ballLifecycleHooks.push(method);
            method.implementation=function(...args) {
                if(always || args[0]===false)revokeQuickBall();
                if(always)revokeQuickSummary();
                return method.call(this,...args);
            };
        }
    } catch(error) {
        quickBallFailed=true;restoreBallLifecycleHooks();ballUnavailable(error);return;
    }
    quickBallTimer=setTimeout(function launchQuickBall(){
        quickBallTimer=null;
        if(disposed || quickBallFailed)return;
        if(bootParameters.quickClose===true&&!quickSummaryNativeReady&&!quickSummaryFailed){quickBallTimer=setTimeout(launchQuickBall,100);return;}
        try {
            quickBall=Script.evaluate('/pgrazor-quick-ball.js',File.readAllText(bootParameters.quickBallPath));
            const result=quickBall.start({enabled:true,onEvent(event) {
                // Cleanup receipts remain useful while disposal awaits native restoration.
                if(!control)return;
                try { Java.performNow(()=>{
                    if(typeof event.kind==='string' && event.kind.startsWith('outcome-')) { ballOutcome(event); return; }
                    if(typeof event.kind==='string' && event.kind.startsWith('trace-')) { control.event('quick-ball-trace',JSON.stringify(event)); return; }
                    if(event.kind==='encounter-position'){event.playerLatitude=control.latitude();event.playerLongitude=control.longitude();event.spawnBooster=control.spawnBooster();}
                    control.event('quick-ball',JSON.stringify(event));
                    if(event.kind==='cooldown-encounter')control.setCooldownEncounter(event.source);
                    if(!disposed && !quickBallFailed && event.kind==='metadata-ready') {
                        quickBallNativeReady=true;
                        control.setQuickBallReady(true,'Ready: 20x catch and break-free animation');
                        control.setThrowReady(!!(event.throws && event.throws.available));
                        control.setThrowArReady(!!(event.arThrows && event.arThrows.available));
                        control.setMapTapReady(!!(event.mapTap && event.mapTap.available));
                    }
                    if(event.kind==='throw-unavailable')control.setThrowReady(false);
                    if(event.kind==='ar-throw-unavailable')control.setThrowArReady(false);
                    if(event.kind==='map-tap-unavailable')control.setMapTapReady(false);
                    if(!disposed && event.kind==='map-tap' && Number.isFinite(event.boottimeMs)) {
                        control.applyMapTap(event.latitude,event.longitude,event.mode,event.epoch,event.boottimeMs);
                    }
                    if(!disposed && (event.kind==='cleanup-pending' || event.kind==='cleanup-failed'))
                        control.setQuickBallReady(false,'Cleanup pending; resume the game to restore animation speed');
                }); } catch(error) { bootLog('quick-ball-event-error: '+error); }
            }});
            Promise.resolve(result).then(value=>{
                quickBallFailed=true;ballUnavailable(value&&(value.reason||value.status)||'Stopped');
            },error=>{quickBallFailed=true;ballUnavailable(error);});
        } catch(error) {quickBallFailed=true;ballUnavailable(error);}
    },1500);
}
// Only natively confirmed outcomes reach Java, which gates the toast again at display time.
const BALL_OUTCOMES = new Set(['caught','broke-free','fled']);
function ballOutcome(event) {
    // A separate log kind keeps the [quick-ball] evidence grammar unchanged.
    control.event('quick-ball-outcome',JSON.stringify(event));
    if (disposed || quickBallFailed || event.kind!=='outcome-confirmed' || !BALL_OUTCOMES.has(event.outcome)) return;
    // A toast failure must not disable acceleration cleanup or location.
    try { control.quickBallOutcome(event.outcome); }
    catch(error) { bootLog('quick-ball-outcome-error: '+error); }
}
function stopQuickBall() {
    if(quickBallTimer!==null){clearTimeout(quickBallTimer);quickBallTimer=null;}
    revokeQuickBall();
    try {return requestBallStop();} catch(error) {return Promise.reject(error);}
}
function heartbeat() {
    Java.performNow(() => {
        control.renewLease();
        if (quickSummary && !quickSummaryFailed && bootParameters.quickSummary===true) {
            try {const dismiss=control.quickSummaryAllowed(),transfer=control.autoTransferAllowed?control.autoTransferAllowed():false;
                if(quickSummary.setTransferOptions)quickSummary.setTransferOptions(transfer,control.transferProtect?control.transferProtect():63,dismiss);
                if(quickSummary.setSpinAllowed)quickSummary.setSpinAllowed(control.quickSpinAllowed?control.quickSpinAllowed():false);
                if(quickSummary.setItemOptions)quickSummary.setItemOptions(control.itemTransferEnabled(),String(control.itemRules()),control.itemAccessAllowed());
                if(quickSummary.setRocketOptions)quickSummary.setRocketOptions(control.rocketOptions(),control.rocketAllowed());
                if(quickSummary.setBattleOptions)quickSummary.setBattleOptions(control.battleOptions(),control.battlesAllowed());
                if(quickSummary.setMapPoiAllowed)quickSummary.setMapPoiAllowed(control.mapPoiAllowed());
                if(quickSummary.setVgpOptions)quickSummary.setVgpOptions(control.vgpEnabled()?control.vgpOptions():0,control.vgpAllowed(),control.latitude(),control.longitude());
                if(quickSummary.setBuddyOptions)quickSummary.setBuddyOptions(control.buddyBerry(),control.buddyAllowed());
                if(quickSummary.setIncubatorOptions)quickSummary.setIncubatorOptions(control.autoIncubate(),control.incubateLongest(),control.incubatorAllowed());
                if(quickSummary.setGiftOptions)quickSummary.setGiftOptions(control.giftOptions(),control.giftsAllowed());
                if(quickSummary.setBerryImpactReady&&(quickBallNativeReady||bootParameters.quickBall!==true))quickSummary.setBerryImpactReady();
                if(quickSummary.setBerryOptions)quickSummary.setBerryOptions(control.autoBerry(),control.berriesAllowed());
                if(quickSummary.setSpawnOptions)quickSummary.setSpawnOptions(control.spawnBooster(),control.spawnAllowed());
                if(quickSummary.setAutoCatchOptions&&control.nativeCatchRequested)quickSummary.setAutoCatchOptions((control.nativeCatchRequested()?1:0)|(control.nativeSpinRequested()?2:0),control.nativeAllowed(),control.nativeBalls(),control.nativeBerry(),control.nativeCurve(),control.nativeGrade(),control.nativeScreenFree(),control.latitude(),control.longitude());
                if(quickSummary.setGymFeedOptions&&control.gymFeedEnabled)quickSummary.setGymFeedOptions(control.gymFeedEnabled(),control.gymFeedBerry(),control.gymFeedAllowed(),control.latitude(),control.longitude());
                if(quickSummary.setResearchOptions&&control.claimResearch)quickSummary.setResearchOptions(control.claimResearch(),String(control.researchRules()),control.researchAllowed());
                quickSummary.setAllowed(dismiss||transfer);}
            catch (error) {bootLog('quick-summary-heartbeat-error: '+error);failQuickSummary(error);}
        }
        if (quickBall && !quickBallFailed && bootParameters.quickBall===true) {
            try {quickBall.setAllowed(control.quickBallAllowed());
                if(quickBall.setThrowOptions)quickBall.setThrowOptions(control.throwGrade(),control.throwCurve(),control.throwAllowed());
                if(quickBall.setArThrowOptions)quickBall.setArThrowOptions(control.throwAr(),control.throwAllowed()&&control.throwArReady());
                if(quickBall.setMapTapOptions)quickBall.setMapTapOptions(control.mapTapMode(),control.mapTapEpoch(),control.mapTapAllowed());}
            catch(error) {
                quickBallFailed=true;ballUnavailable(error);
                try {requestBallStop();} catch(_) {}
            }
        }
        if (bootParameters.cameraSample === true && control.takeCameraSampleRequest()) {
            if (diagnosticTimer !== null) { clearTimeout(diagnosticTimer); diagnosticTimer = null; }
            setImmediate(runDiagnostic);
        }
        if (bootParameters.interactionProbe === true) {
            if (control.takeInteractionStopRequest()) stopInteraction();
            if (control.takeInteractionTraceRequest()) {
                if (interactionTimer!==null) {clearTimeout(interactionTimer);interactionTimer=null;}
                setImmediate(()=>runInteraction(true));
            }
        }
    });
}
function start() {
    if (disposed) return;
    try {
        const source = File.readAllText(bootParameters.bridgePath);
        globalThis.Java = Script.evaluate('/pgrazor-java-bridge.js', source + '\nbridge;');
        bootLog('java-bridge-loaded');
        // init() has already returned. Waiting for the application class loader
        // here cannot hold the dynamic linker constructor open.
        Java.perform(() => {
            if (disposed) return;
            try {
                control = Java.use('dev.pgrazor.Control');
                const Location = Java.use('android.location.Location');
                for (const [name, getter] of [['getLatitude','latitude'],['getLongitude','longitude'],['getSpeed','speed'],['getBearing','bearing']]) {
                    const method = Location[name].overload();
                    method.implementation = function () {
                        if (control.active()) return control[getter]();
                        return method.call(this);
                    };
                    hooks.push(method);
                }
                control.connect();
                if (bootParameters.cameraSample === true) control.configureCameraDiagnostics(true);
                if (bootParameters.cameraSteering === true) control.configureCameraSteering(true);
                if (bootParameters.interactionProbe === true && bootParameters.interactionProbePath) control.configureInteractionDiagnostics(true);
                control.event('embedded-ready', 'Java Location getters installed; saved preference restoration scheduled; see state-activation; game acceptance unverified');
                bootLog('embedded-ready');
                timer = setInterval(heartbeat, 2000);
                scheduleDiagnostic();
                scheduleInteraction();
                scheduleQuickSummary();
                scheduleQuickBall();
            } catch (error) {
                rollback();
                if (control) { control.embedded('Embedded adapter failed - open Run log'); control.event('embedded-error',String(error)); }
                bootLog('embedded-error: ' + error);
            }
        });
    } catch (error) { bootLog('embedded-error: ' + error); }
}
rpc.exports = {
    init(stage, parameters) { bootParameters = parameters || {}; setImmediate(start); },
    dispose() {
        disposed = true;
        if (diagnosticTimer !== null) clearTimeout(diagnosticTimer);
        const diagnosticStopped = diagnostic !== null ? diagnostic.stop() : undefined;
        const interactionStopped=stopInteraction();
        const summaryStopped=stopQuickSummary();
        const ballStopped=stopQuickBall();
        if (timer !== null) clearInterval(timer);
        if (typeof Java !== 'undefined') Java.performNow(() => {
            rollback();
            restoreSummaryLifecycleHooks();
            restoreBallLifecycleHooks();
            if (control) {
                if (bootParameters.cameraSample === true) control.setCameraDiagnosticRunning(false);
                if (bootParameters.cameraSteering === true) control.invalidateCameraHeading('Adapter disposed');
                if (bootParameters.interactionProbe === true) control.setInteractionDiagnosticRunning(false);
                if (bootParameters.quickSummary === true) {
                    try { control.setQuickSummaryReady(false,'Adapter stopped'); }
                    catch (error) { bootLog('quick-summary-status-error: '+error); }
                }
                if (bootParameters.quickBall === true) {
                    try { control.setQuickBallReady(false,'Adapter stopping; native cleanup may await resume'); }
                    catch (error) { bootLog('quick-ball-status-error: '+error); }
                }
                Java.scheduleOnMainThread(() => control.disconnect());
            }
        });
        return Promise.all([diagnosticStopped,interactionStopped,summaryStopped,ballStopped]);
    }
};
