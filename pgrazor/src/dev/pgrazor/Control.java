package dev.pgrazor;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.StrictMode;
import android.os.SystemClock;
import android.util.AtomicFile;
import android.util.Log;
import android.widget.Toast;
import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Module interface shared by the standalone preview and an instrumented host. */
public final class Control {
    private static volatile boolean mapPoiOpen,autoWalkPlanning;
    private static volatile String mapPoiSnapshot="";
    private static volatile long mapPoiAt;
    public static void setMapPoiOpen(boolean open){mapPoiOpen=open;if(!open&&!autoWalkPlanning){mapPoiSnapshot="";mapPoiAt=0;}}
    public static void setAutoWalkPlanning(boolean open){autoWalkPlanning=open;if(!open&&!mapPoiOpen){mapPoiSnapshot="";mapPoiAt=0;}}
    public static boolean mapPoiAllowed(){return (mapPoiOpen||autoWalkPlanning)&&foreground&&backendReady&&connected();}
    public static void setMapPoiSnapshot(String value){if((mapPoiOpen||autoWalkPlanning)&&value!=null&&value.length()<160000){mapPoiSnapshot=value;mapPoiAt=SystemClock.elapsedRealtime();}}
    public static String mapPoiSnapshot(){return SystemClock.elapsedRealtime()-mapPoiAt<10000?mapPoiSnapshot:"";}
    public static final MotionEngine engine = new MotionEngine();
    public static volatile String connection = "PREVIEW - game not connected";
    public static volatile long latitudeReads, longitudeReads;
    private static PrintWriter log;
    private static File logFile;
    private static Pad pad;
    private static boolean registered;
    private static volatile long leaseDeadline;
    private static volatile boolean instrumented;
    private static volatile boolean leaseExpired;
    private static volatile boolean preview = true, backendReady;
    private static final boolean desiredEnabled = true;
    private static volatile boolean foreground;
    private static volatile boolean cameraDiagnosticsConfigured;
    private static volatile boolean cameraDiagnosticRunning;
    private static volatile String cameraDiagnosticStatus = "";
    private static final AtomicBoolean cameraSampleRequest = new AtomicBoolean();
    private static volatile boolean interactionDiagnosticsConfigured, interactionDiagnosticRunning;
    private static volatile String interactionDiagnosticStatus="";
    private static final AtomicBoolean interactionTraceRequest=new AtomicBoolean(), interactionStopRequest=new AtomicBoolean();
    private static final Object quickSummaryLock=new Object();
    private static volatile boolean quickSummaryConfigured, quickSummaryReady, quickSummaryEnabled;
    private static volatile boolean quickSummaryAutoDismiss;
    private static volatile boolean autoTransferEnabled, autoTransferReady;
    private static volatile int transferProtect=63;
    private static volatile String transferStatus="Waiting for transfer support";
    private static volatile String quickSummaryStatus="";
    private static final Object quickBallLock=new Object();
    private static volatile boolean quickBallConfigured, quickBallReady, quickBallEnabled;
    private static volatile String quickBallStatus="";
    private static volatile boolean throwReady, throwCurve, throwAr, throwArReady;
    private static volatile int throwGrade;
    private static volatile int mapTapMode, mapTapEpoch;
    private static volatile boolean mapTapReady;
    /** Guarded by quickBallLock; any change invalidates a queued outcome toast. */
    private static long quickBallOutcomeToken;
    /** Main thread only. */
    private static volatile boolean spawnBooster,spawnReady;
    private static volatile long spawnRangeAt;
    private static volatile double spawnOriginal,spawnEffective;
    public static void setSpawnRange(double original,double effective){if(!spawnBooster||!spawnAllowed()||!Double.isFinite(original)||!Double.isFinite(effective)||original<=0||effective<original)return;spawnOriginal=original;spawnEffective=effective;spawnRangeAt=SystemClock.elapsedRealtime();}
    public static String spawnStatus(){
        if(!spawnBooster)return "Off";
        if(!spawnAllowed())return "Waiting for map support";
        if(spawnRangeAt==0||SystemClock.elapsedRealtime()-spawnRangeAt>5000)return "Waiting for a range check; move a few steps on the map";
        return String.format(java.util.Locale.US,"Range check: %.0f to %.0f m (local)",spawnOriginal,spawnEffective);
    }
    public static boolean spawnBooster(){return spawnBooster;}
    public static void setSpawnBooster(boolean enabled){spawnRangeAt=0;spawnBooster=enabled;saveSettings();}
    public static void setSpawnReady(boolean ready){spawnReady=ready;if(!ready)spawnRangeAt=0;}
    public static boolean spawnAllowed(){return spawnReady&&quickSummaryReady()&&foreground&&backendReady&&connected();}
    private static volatile int giftOptions;
    private static volatile boolean giftsReady;
    private static volatile String giftStatus="Waiting for gift support";
    public static int giftOptions(){return giftOptions;}
    public static void setGiftOptions(int value){if(value<0||value>7)return;giftOptions=value;saveSettings();}
    public static void setGiftsReady(boolean ready,String status){giftsReady=ready;giftStatus=status;}
    public static void setGiftStatus(String status){giftStatus=status;}
    public static String giftStatus(){return giftStatus;}
    public static boolean giftsAllowed(){return giftsReady&&quickSummaryReady()&&foreground&&backendReady&&connected();}
    private static volatile boolean vgpEnabled,vgpReady,vgpOverlay;
    /** Persistent safety preference; when armed a live cooldown keeps VGP off. */
    private static volatile boolean vgpStopOnCooldown;
    private static volatile int vgpOptions=3;
    private static volatile String vgpStatus="Waiting for VGP support";
    /** Sticky reason for the current VGP pause/refusal; takes priority over native status when set. */
    private static volatile String vgpGuardReason="";
    /** Serializes the compound enabled/overlay/guard decisions; never held across Cooldown or stateLock. */
    private static final Object vgpLock=new Object();
    private static Application vgpApplication;
    public static boolean vgpEnabled(){guardVgpCooldown();return autoEngine==0&&vgpOverlay&&vgpEnabled;}
    public static boolean vgpOverlay(){return vgpOverlay;}
    public static void setVgpOverlay(boolean value){synchronized(vgpLock){vgpOverlay=value;if(!value)vgpEnabled=false;vgpTargetAt=0;vgpGuardReason="";}saveSettings();}
    public static boolean vgpOverlayVisible(){return vgpOverlay&&foreground&&backendReady&&connected();}
    public static int vgpOptions(){return vgpOptions;}
    public static boolean vgpStopOnCooldown(){return vgpStopOnCooldown;}
    /**
     * VGP active state is runtime only (never persisted). Turning it on while the cooldown
     * guard is armed and a cooldown is live is refused with a visible reason; turning it off
     * clears any guard reason.
     */
    public static void setVgpEnabled(boolean value){
        if(value&&autoEngine==1){autoEngine=0;nativeCatch=false;nativeSpin=false;saveSettings();event("auto-engine","PGRazor VGP; native stopped");}
        if(!value){synchronized(vgpLock){vgpEnabled=false;vgpTargetAt=0;vgpGuardReason="";vgpStatus="Off";}return;}
        // Read Cooldown before taking vgpLock so the two locks are never nested.
        boolean cooldownActive=vgpStopOnCooldown&&Cooldown.remaining()>0;
        boolean refused=false,enabled=false;
        synchronized(vgpLock){
            if(!vgpOverlay||!foreground){vgpEnabled=false;vgpTargetAt=0;}
            else if(cooldownActive){vgpEnabled=false;vgpTargetAt=0;vgpGuardReason="Cooldown active; tap VGP after it clears";refused=true;}
            else{vgpEnabled=true;vgpGuardReason="";enabled=true;}
        }
        if(refused)event("vgp-cooldown-guard","Enable refused; cooldown active");
        else if(enabled)event("vgp-enabled","ON; runtime only");
    }
    /**
     * Arms or disarms the optional cooldown safety. Arming it while VGP is already active and a
     * cooldown is live switches VGP off immediately; disarming clears any lingering guard reason.
     */
    public static void setVgpStopOnCooldown(boolean value){
        boolean cooldownActive=value&&Cooldown.remaining()>0;
        boolean tripped=false;
        synchronized(vgpLock){
            vgpStopOnCooldown=value;
            if(!value)vgpGuardReason="";
            else if(vgpEnabled&&cooldownActive){vgpEnabled=false;vgpTargetAt=0;vgpGuardReason="Paused for active cooldown; tap VGP to resume once it clears";tripped=true;}
        }
        saveSettings();
        event("vgp-stop-on-cooldown",value?(tripped?"ON; switched VGP off for active cooldown":"ON"):"OFF");
    }
    public static void setVgpOptions(int value){vgpOptions=value&7;saveSettings();}
    public static void setVgpReady(boolean ready,String status){vgpReady=ready;vgpStatus=status;}
    public static void setVgpStatus(String status){vgpStatus=status;}
    /** A guard reason (cooldown pause/refusal) is shown in place of a generic native status. */
    public static String vgpStatus(){String reason=vgpGuardReason;return reason.length()>0?reason:vgpStatus;}
    /**
     * When the guard is armed, a live cooldown trips VGP off before the next request and it stays
     * off (no auto-resume). Driven by the vgpEnabled()/vgpAllowed() heartbeat; the Cooldown read
     * happens with no lock held and logs only on the single off transition.
     */
    private static void guardVgpCooldown(){
        if(!(vgpEnabled&&vgpStopOnCooldown))return;
        if(Cooldown.remaining()<=0)return;
        boolean tripped=false;
        synchronized(vgpLock){
            if(vgpEnabled&&vgpStopOnCooldown){vgpEnabled=false;vgpTargetAt=0;vgpGuardReason="Paused for active cooldown; tap VGP to resume once it clears";tripped=true;}
        }
        if(tripped)event("vgp-cooldown-guard","VGP switched off; cooldown active");
    }
    private static volatile float vgpTargetX,vgpTargetY;
    private static volatile long vgpTargetAt;
    private static volatile boolean vgpTargetSpin;
    public static void setVgpTarget(boolean visible,double x,double y,boolean spin){
        if(!visible){if(vgpTargetAt>0)vgpTargetAt=Math.min(vgpTargetAt,SystemClock.elapsedRealtime()-600);return;}
        if(!Double.isFinite(x)||!Double.isFinite(y)||x<0||x>1||y<0||y>1){vgpTargetAt=0;return;}
        vgpTargetX=(float)x;vgpTargetY=(float)y;vgpTargetSpin=spin;vgpTargetAt=SystemClock.elapsedRealtime();
    }
    public static boolean vgpTargetVisible(){long age=SystemClock.elapsedRealtime()-vgpTargetAt;return vgpAllowed()&&vgpTargetAt>0&&age>=0&&age<1200;}
    public static float vgpTargetX(){return vgpTargetX;}
    public static float vgpTargetY(){return vgpTargetY;}
    public static boolean vgpTargetSpin(){return vgpTargetSpin;}

    public static boolean vgpAllowed(){guardVgpCooldown();long age=SystemClock.elapsedRealtime()-buddyMapSample;return autoEngine==0&&vgpEnabled&&vgpReady&&itemAccessAllowed()&&buddyMapSample>0&&age>=0&&age<1500;}
    public static void vgpResult(String action,boolean success){
        if(success&&action.equals("spin"))cooldownAction("Pokestop spin");
        Application app=vgpApplication;if(!vgpEnabled||(vgpOptions&4)==0||app==null)return;
        if(android.os.Build.VERSION.SDK_INT>=33&&app.checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=android.content.pm.PackageManager.PERMISSION_GRANTED)return;
        try{android.app.NotificationManager manager=(android.app.NotificationManager)app.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
            manager.createNotificationChannel(new android.app.NotificationChannel("pgrazor-vgp","PGRazor VGP",android.app.NotificationManager.IMPORTANCE_LOW));
            String message=action.equals("catch")?(success?"Pok\u00e9mon caught":"Pok\u00e9mon not caught"):(success?"Pok\u00e9Stop spun":"Spin unsuccessful");
            manager.notify(7301,new android.app.Notification.Builder(app,"pgrazor-vgp").setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("PGRazor VGP").setContentText(message).setAutoCancel(true).build());
        }catch(RuntimeException error){event("vgp-notification-error",error.toString());}
    }

    // ----- Rasiel-native auto catch/spin, gym feeding, and field research -----
    /** 0 = PGRazor VGP, 1 = Rasiel-native engine. */
    private static volatile int autoEngine;
    private static volatile boolean nativeCatch,nativeSpin,nativeReady;
    private static volatile String nativeStatus="Requires the --quick-close build";
    /** Bit 0 = Poke Ball, bit 1 = Great Ball, bit 2 = Ultra Ball. */
    private static volatile int nativeBalls=1;
    /** 0 = no berry; otherwise one of 701/703/705/706/707. */
    private static volatile int nativeBerry;
    private static volatile boolean nativeCurve=true;
    /** 0 = off, 1 = Nice, 2 = Great, 3 = Excellent. */
    private static volatile int nativeGrade=3;
    private static volatile boolean nativeScreenFree;
    private static volatile boolean gymFeedEnabled,gymFeedReady;
    private static volatile int gymFeedBerry;
    private static volatile String gymFeedStatus="Requires the --quick-close build";
    private static volatile boolean claimResearch,researchReady;
    private static volatile String researchRules="",researchStatus="Requires the --quick-close build";
    public static int autoEngine(){return autoEngine;}
    public static String autoEngineName(){return autoEngine==1?"Rasiel native":"PGRazor VGP";}
    /**
     * Switches the automation engine. Only one engine may run: selecting native stops VGP,
     * and selecting VGP clears the native catch/spin toggles. The selected engine itself is
     * not started here; the quick-menu Auto Catch/Auto Spin rows (or the switches) do that.
     */
    public static void setAutoEngine(int value){
        if(value!=0&&value!=1)return;
        if(autoEngine==value)return;
        autoEngine=value;
        nativeCatch=false;nativeSpin=false;
        if(value==1)setVgpEnabled(false);
        saveSettings();
        event("auto-engine",value==1?"Rasiel native; VGP stopped":"PGRazor VGP; native stopped");
    }
    public static boolean autoCatchOn(){return autoEngine==1?nativeCatch:(vgpEnabled&&(vgpOptions&1)!=0);}
    public static boolean autoSpinOn(){return autoEngine==1?nativeSpin:(vgpEnabled&&(vgpOptions&2)!=0);}
    public static void toggleAutoCatch(){
        if(autoEngine==1){setNativeCatch(!nativeCatch);return;}
        if(autoCatchOn()){
            vgpOptions&=~1;
            if((vgpOptions&3)==0)setVgpEnabled(false);
            saveSettings();event("auto-catch","OFF");
        }else{
            if(!vgpOverlay)setVgpOverlay(true);
            vgpOptions|=1;setVgpEnabled(true);saveSettings();event("auto-catch","ON; PGRazor VGP");
        }
    }
    public static void toggleAutoSpin(){
        if(autoEngine==1){setNativeSpin(!nativeSpin);return;}
        if(autoSpinOn()){
            vgpOptions&=~2;
            if((vgpOptions&3)==0)setVgpEnabled(false);
            saveSettings();event("auto-spin","OFF");
        }else{
            if(!vgpOverlay)setVgpOverlay(true);
            vgpOptions|=2;setVgpEnabled(true);saveSettings();event("auto-spin","ON; PGRazor VGP");
        }
    }
    public static boolean nativeCatch(){return nativeCatch;}
    public static void setNativeCatch(boolean value){
        if(value){
            if(autoEngine!=1){autoEngine=1;saveSettings();event("auto-engine","Rasiel native");}
            setVgpEnabled(false);
        }
        nativeCatch=value;saveSettings();event("native-catch",value?"ON":"OFF");
    }
    public static boolean nativeSpin(){return nativeSpin;}
    public static void setNativeSpin(boolean value){
        if(value){
            if(autoEngine!=1){autoEngine=1;saveSettings();event("auto-engine","Rasiel native");}
            setVgpEnabled(false);
        }
        nativeSpin=value;saveSettings();event("native-spin",value?"ON":"OFF");
    }
    public static boolean nativeCatchRequested(){return autoEngine==1&&nativeCatch;}
    public static boolean nativeSpinRequested(){return autoEngine==1&&nativeSpin;}
    public static boolean nativeReady(){return nativeReady;}
    public static void setNativeReady(boolean ready,String status){nativeReady=ready;nativeStatus=status==null?"":status;}
    public static String nativeStatus(){return nativeStatus;}
    public static void setNativeStatus(String status){nativeStatus=status==null?"":status;}
    public static boolean nativeAvailable(){return nativeReady&&itemAccessAllowed();}
    public static boolean nativeAllowed(){return autoEngine==1&&(nativeCatch||nativeSpin)&&nativeAvailable()&&foreground&&backendReady&&connected();}
    public static int nativeBalls(){return nativeBalls;}
    public static void setNativeBalls(int mask){if(mask<1||mask>7)return;nativeBalls=mask;saveSettings();event("native-balls",String.valueOf(mask));}
    public static int nativeBerry(){return nativeBerry;}
    public static void setNativeBerry(int id){if(!berryChoice(id))return;nativeBerry=id;saveSettings();}
    public static boolean nativeCurve(){return nativeCurve;}
    public static void setNativeCurve(boolean value){nativeCurve=value;saveSettings();event("native-curve",value?"ON":"OFF");}
    public static int nativeGrade(){return nativeGrade;}
    public static void setNativeGrade(int grade){if(grade<0||grade>3)return;nativeGrade=grade;saveSettings();event("native-grade",String.valueOf(grade));}
    public static boolean nativeScreenFree(){return nativeScreenFree;}
    public static void setNativeScreenFree(boolean value){nativeScreenFree=value;saveSettings();event("native-screen-free",value?"ON":"OFF");}
    public static boolean gymFeedEnabled(){return gymFeedEnabled;}
    public static void setGymFeedEnabled(boolean value){gymFeedEnabled=value;saveSettings();event("gym-feed-setting",value?"ON":"OFF");}
    public static int gymFeedBerry(){return gymFeedBerry;}
    public static void setGymFeedBerry(int id){if(!berryChoice(id))return;gymFeedBerry=id;saveSettings();}
    public static boolean gymFeedAvailable(){return gymFeedReady&&itemAccessAllowed();}
    public static boolean gymFeedAllowed(){return gymFeedEnabled&&gymFeedAvailable()&&foreground&&backendReady&&connected();}
    public static boolean gymFeedReady(){return gymFeedReady;}
    public static void setGymFeedReady(boolean ready,String status){gymFeedReady=ready;gymFeedStatus=status==null?"":status;}
    public static String gymFeedStatus(){return gymFeedStatus;}
    public static void setGymFeedStatus(String status){gymFeedStatus=status==null?"":status;}
    public static boolean claimResearch(){return claimResearch;}
    public static void setClaimResearch(boolean value){claimResearch=value;saveSettings();event("research-claim",value?"ON":"OFF");}
    public static String researchRules(){return researchRules;}
    public static boolean researchReady(){return researchReady;}
    public static void setResearchReady(boolean ready,String status){researchReady=ready;researchStatus=status==null?"":status;}
    public static String researchStatus(){return researchStatus;}
    public static void setResearchStatus(String status){researchStatus=status==null?"":status;}
    public static boolean researchActive(){return claimResearch||!researchRules.trim().isEmpty();}
    public static boolean researchAvailable(){return researchReady&&quickSummaryReady()&&foreground&&backendReady&&connected();}
    public static boolean researchAllowed(){return researchActive()&&researchAvailable();}
    /** Validates and stores the field-research filter; each non-empty line is {@code task|reward}. */
    public static void setResearchOptions(boolean claim,String rules){
        researchRules=normalizeResearchRules(rules);claimResearch=claim;saveSettings();
        event("research-options",(claim?"claim ON":"claim OFF")+"; rules="+researchRuleCount());
    }
    private static boolean berryChoice(int id){return id==0||id==701||id==703||id==705||id==706||id==707;}
    private static int researchRuleCount(){
        if(researchRules.isEmpty())return 0;int n=0;for(String line:researchRules.split("\\n"))if(!line.trim().isEmpty())n++;return n;
    }
    private static String normalizeResearchRules(String rules){
        if(rules==null)return "";
        if(rules.length()>8000)throw new IllegalArgumentException("Research filter is too long");
        StringBuilder out=new StringBuilder();int count=0;
        for(String raw:rules.split("\\r?\\n")){
            String line=raw.trim();if(line.isEmpty())continue;
            int bar=line.indexOf('|');
            String text=(bar<0?line:line.substring(0,bar)).trim();
            String reward=(bar<0?"*":line.substring(bar+1)).trim();
            if(text.length()>200||reward.length()>200)throw new IllegalArgumentException("Research rule is too long");
            if(text.isEmpty())text="*";
            if(reward.isEmpty())reward="*";
            if(count>=64)throw new IllegalArgumentException("At most 64 research rules are supported");
            if(count++>0)out.append('\n');
            out.append(text).append('|').append(reward);
        }
        return out.toString();
    }

    private static volatile boolean autoIncubate, incubateLongest, incubatorReady;
    private static volatile String incubatorStatus="Waiting for incubation support";
    public static boolean autoIncubate(){return autoIncubate;}
    public static boolean incubateLongest(){return incubateLongest;}
    public static void setAutoIncubate(boolean v){autoIncubate=v;saveSettings();}
    public static void setIncubateLongest(boolean v){incubateLongest=v;saveSettings();}
    public static void setIncubatorReady(boolean ready,String status){incubatorReady=ready;incubatorStatus=status;}
    public static void setIncubatorStatus(String status){incubatorStatus=status;}
    public static String incubatorStatus(){return incubatorStatus;}
    public static boolean incubatorAvailable(){return incubatorReady&&itemAccessAllowed();}
    public static boolean incubatorAllowed(){long age=SystemClock.elapsedRealtime()-buddyMapSample;return autoIncubate&&incubatorAvailable()&&buddyMapSample>0&&age>=0&&age<1500;}
    private static volatile int buddyBerry;
    private static volatile boolean buddyReady;
    private static volatile long buddyMapSample;
    private static volatile String buddyStatus="Waiting for buddy support";
    public static int buddyBerry(){return buddyBerry;}
    public static void setBuddyBerry(int id){if(id!=0&&id!=701&&id!=703&&id!=705&&id!=706&&id!=707)return;buddyBerry=id;saveSettings();}
    public static void setBuddyReady(boolean ready,String status){buddyReady=ready;buddyStatus=status;}
    public static void setBuddyStatus(String status){buddyStatus=status;}
    public static String buddyStatus(){return buddyStatus;}
    public static boolean buddyAvailable(){return buddyReady&&itemAccessAllowed();}
    public static boolean buddySamplingRequested(){return (buddyBerry!=0||vgpEnabled||autoIncubate)&&foreground&&backendReady&&connected();}
    public static boolean buddyAllowed(){long age=SystemClock.elapsedRealtime()-buddyMapSample;return buddyAvailable()&&buddyMapSample>0&&age>=0&&age<1500;}
    private static volatile boolean encounterBerryActive,encounterBerryBusy;
    private static volatile long encounterBerrySeen;
    public static void setEncounterBerry(boolean active,boolean busy){encounterBerryActive=active;encounterBerryBusy=busy;encounterBerrySeen=SystemClock.elapsedRealtime();}
    public static boolean encounterBerryVisible(){long age=SystemClock.elapsedRealtime()-encounterBerrySeen;return encounterBerryEnabled&&encounterBerryActive&&age>=0&&age<2000&&foreground&&quickSummaryReady();}
    public static boolean encounterBerryBusy(){return encounterBerryBusy;}
    private static volatile boolean cooldownOverlay;
    private static volatile String cooldownEncounter="";
    public static boolean cooldownOverlay(){return cooldownOverlay;}
    public static void setCooldownOverlay(boolean value){cooldownOverlay=value;saveSettings();}
    public static void setCooldownEncounter(String value){cooldownEncounter=value==null?"":value.toLowerCase(java.util.Locale.US);}
    public static void cooldownAction(String action){
        if(!foreground||!backendReady||!connected())return;
        if(action.equals("Ball throw")||action.equals("Ball drop")||action.equals("Berry feeding")){
            boolean wild=cooldownEncounter.contains("wild"),raid=cooldownEncounter.contains("raid");
            if(!wild&&!(raid&&!action.equals("Ball throw")))return;
        }
        Cooldown.record(action);
    }
    private static volatile int autoBerry;
    private static volatile boolean encounterBerryEnabled;
    private static volatile boolean berryReady;
    /** Effective choice the native feeder reads: 0 (no feeding) whenever the overlay master is off. */
    public static int autoBerry(){return encounterBerryEnabled?autoBerry:0;}
    /** Raw user selection shown in the overlay; retained while the master is off so it can be re-enabled. */
    public static int autoBerrySelected(){return autoBerry;}
    public static boolean encounterBerryEnabled(){return encounterBerryEnabled;}
    public static void setEncounterBerryEnabled(boolean enabled){encounterBerryEnabled=enabled;saveSettings();event("encounter-berry-overlay",enabled?"ON":"OFF; feeding stopped, choice retained");}
    public static void setAutoBerry(int id){if(id!=0&&id!=701&&id!=703&&id!=705&&id!=706&&id!=707)return;autoBerry=id;if(id!=0)encounterBerryEnabled=true;saveSettings();}
    public static void setBerryReady(boolean ready){berryReady=ready;}
    public static boolean berriesAllowed(){return berryReady&&itemAccessAllowed();}
    public static int berryCount(int id){for(String row:itemCatalog.split("\n")){String[] b=row.split("\\|",-1);try{if(b.length==3&&Integer.parseInt(b[0])==id)return Integer.parseInt(b[2]);}catch(NumberFormatException ignored){}}return 0;}
    private static volatile int battleOptions;
    private static volatile boolean battlesReady;
    private static volatile String battleStatus="Waiting for battle support";
    public static int battleOptions(){return battleOptions;}
    public static String battleStatus(){return battleStatus;}
    public static void setBattleOptions(int value){if(value<0||value>1023)return;battleOptions=value;saveSettings();event("battle-options",String.valueOf(value));}
    public static void setBattlesReady(boolean ready,String status){battlesReady=ready;battleStatus=status;}
    public static void setBattleStatus(String status){battleStatus=status;}
    public static boolean battlesAllowed(){return battlesReady&&quickSummaryReady()&&foreground&&backendReady&&connected();}
    private static volatile int rocketOptions;
    private static volatile boolean rocketReady;
    private static volatile String rocketStatus="Waiting for battle support";
    public static int rocketOptions(){return rocketOptions;}
    public static String rocketStatus(){return rocketStatus;}
    public static void setRocketOptions(int value){if(value<0||value>7)return;rocketOptions=value;saveSettings();event("rocket-options",String.valueOf(value));}
    public static void setRocketReady(boolean ready,String status){rocketReady=ready;rocketStatus=status;}
    public static void setRocketStatus(String status){rocketStatus=status;}
    public static boolean rocketAllowed(){return rocketReady&&quickSummaryReady()&&foreground&&backendReady&&connected();}
    private static volatile boolean itemTransferEnabled,itemTransferReady;
    private static volatile String itemRules="",itemLimits="",itemCatalog="",itemStatus="Waiting for item bag";
    public static boolean itemTransferEnabled(){return itemTransferEnabled;}
    public static String itemRules(){return itemRules;}
    public static String itemLimits(){return itemLimits;}
    public static String itemCatalog(){return itemCatalog;}
    public static String itemStatus(){return itemStatus;}
    public static boolean itemAccessAllowed(){return itemTransferReady&&quickSummaryReady()&&foreground&&backendReady&&connected();}
    public static void setItemReady(boolean ready,String status){itemTransferReady=ready;itemStatus=status;}
    public static void setItemStatus(String status){itemStatus=status==null?"":status;}
    public static void setItemCatalog(String value){
        if(value==null||value.length()>100000)return;
        TreeMap<Integer,String> rows=new TreeMap<>();
        for(String row:itemCatalog.split("\n")){String[] bits=row.split("\\|",-1);try{if(bits.length==3)rows.put(Integer.parseInt(bits[0]),bits[0]+"|"+bits[1]+"|0");}catch(NumberFormatException ignored){}}
        for(String row:value.split("\n")){String[] bits=row.split("\\|",-1);try{if(bits.length==3&&Integer.parseInt(bits[0])>0&&Integer.parseInt(bits[2])>=0)rows.put(Integer.parseInt(bits[0]),row);}catch(NumberFormatException ignored){}}
        itemCatalog=String.join("\n",rows.values());itemStatus="Ready: "+rows.size()+" recyclable item types";
    }
    private static boolean validItemRules(String value){
        if(value==null||value.length()>30000)return false;HashSet<Integer> seen=new HashSet<>();
        for(String row:value.split(";")){if(row.isEmpty())continue;if(!row.matches("[0-9]{1,7}:[0-9]{1,6}"))return false;String[] b=row.split(":");int id=Integer.parseInt(b[0]),cap=Integer.parseInt(b[1]);if(id<=0||cap>100000||!seen.add(id))return false;}return true;
    }
    public static void saveItemRules(boolean enabled,String rules,String limits){
        if(!validItemRules(rules)||!validItemRules(limits))throw new IllegalArgumentException("Invalid item limit");
        itemRules=rules;itemLimits=limits;itemTransferEnabled=enabled;saveSettings();event("item-rules",enabled?"Enabled":"Disabled");
    }
    private static volatile boolean quickSpinEnabled, quickSpinReady;
    private static volatile String quickSpinStatus="Waiting for game";
    public static boolean quickSpinEnabled() { return quickSpinEnabled; }
    public static String quickSpinStatus() { return quickSpinStatus; }
    public static void setQuickSpinEnabled(boolean value) { quickSpinEnabled=value; saveSettings(); event("quick-spin-setting",value?"ON":"OFF"); }
    public static void setQuickSpinReady(boolean value,String status) { quickSpinReady=value; quickSpinStatus=status; }
    public static boolean quickSpinAllowed() { return quickSpinEnabled && quickSpinReady && quickSummaryReady() && foreground && backendReady && connected(); }
    private static Toast quickBallToast;
    private static volatile boolean cameraSteeringConfigured;
    private static final CameraHeadingState cameraHeading = new CameraHeadingState();
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static final Object stateLock = new Object();
    private static final Object logLock = new Object();
    private static AtomicFile stateFile, settingsFile;
    private static String lastSaved;
    private static long lastCheckpoint;
    private static boolean stateWriteFailed;
    private static final AtomicBoolean checkpointPending = new AtomicBoolean();
    private static final ExecutorService stateWriter = Executors.newSingleThreadExecutor(task -> {
        Thread thread = new Thread(task, "pgrazor-state-writer"); thread.setDaemon(true); return thread;
    });
    public static void embedded(String status) {
        engine.pause(); preview = false; backendReady = false; connection = status;
        setQuickSummaryReady(false,"Waiting for catch summary support");
        setQuickBallReady(false,"Waiting for ball animation support");
        invalidateCameraHeading("Adapter initializing");
        cameraSampleRequest.set(false);
        cameraDiagnosticRunning = false;
        saveState();
    }
    public static boolean preview() { return preview; }
    /** Saved user choices survive readiness and lifecycle changes. */
    public static void configureQuickSummary(boolean configured) {
        synchronized(quickSummaryLock) {
            quickSummaryConfigured=configured; quickSummaryReady=false; autoTransferReady=false;
            quickSummaryStatus=configured ? "Checking catch summary support" : "";
        }
    }
    public static boolean quickSummaryConfigured() { return quickSummaryConfigured; }
    public static void configureQuickSummaryAutoDismiss(boolean enabled) {
        quickSummaryAutoDismiss=enabled;
        // Native catch/spin, gym feeding, and field research ship only in the
        // quick-close script; keep the settings status honest in other builds.
        if(!enabled){nativeStatus="Requires the --quick-close build";gymFeedStatus="Requires the --quick-close build";researchStatus="Requires the --quick-close build";}
        else{if(nativeStatus.startsWith("Requires"))nativeStatus="Waiting for Rasiel native support";if(gymFeedStatus.startsWith("Requires"))gymFeedStatus="Waiting for gym feed support";if(researchStatus.startsWith("Requires"))researchStatus="Waiting for field research support";}
    }
    public static boolean quickSummaryAutoDismiss() { return quickSummaryAutoDismiss; }
    public static boolean quickSummaryReady() { return quickSummaryConfigured && quickSummaryReady; }
    public static boolean quickSummaryEnabled() { return quickSummaryEnabled; }
    public static String quickSummaryStatus() { return quickSummaryStatus; }
    public static void setQuickSummaryReady(boolean ready,String status) {
        boolean disabled;
        synchronized(quickSummaryLock) {
            quickSummaryReady=quickSummaryConfigured && ready;
            if(!quickSummaryReady)autoTransferReady=false;
            disabled=quickSummaryEnabled && !quickSummaryReady;

            String text=status==null || status.length()==0 ? (quickSummaryReady ? "Ready" : "Unavailable") : status;
            quickSummaryStatus=quickSummaryConfigured ? text.substring(0,Math.min(text.length(),320)) : "";
        }
        if(disabled)event("quick-summary-setting","Suspended; saved choice retained");
    }
    public static void setQuickSummaryEnabled(boolean enabled) {
        boolean changed,actual;
        synchronized(quickSummaryLock) {
            actual=enabled;
            changed=quickSummaryEnabled!=actual; quickSummaryEnabled=actual;
        }
        // One Quick Catch choice controls dismissal and the 20x animation.
        setQuickBallEnabled(actual);
        if(changed)event("quick-summary-setting",actual ? (quickSummaryAutoDismiss ? "ON; summary and details auto-dismiss; new-species screens remain" : "ON; shorter post-catch wait; summary stays open") : "OFF");
    }
    public static boolean quickSummaryAllowed() {
        return quickSummaryEnabled && quickSummaryReady && foreground && backendReady && connected();
    }
    public static boolean autoTransferEnabled(){return autoTransferEnabled;}
    public static boolean autoTransferReady(){return quickSummaryReady()&&autoTransferReady;}
    public static int transferProtect(){return transferProtect;}
    public static String transferStatus(){return transferStatus;}
    public static void setAutoTransferEnabled(boolean enabled){invalidateQuickBallOutcome();autoTransferEnabled=enabled;saveSettings();event("auto-transfer-setting",enabled?"ON; new catches below90percent only":"OFF");}
    public static void setTransferProtect(int mask){transferProtect=mask>=0&&mask<=63?mask:63;saveSettings();event("auto-transfer-protection",String.valueOf(transferProtect));}
    public static void setAutoTransferReady(boolean ready,String status){autoTransferReady=ready&&quickSummaryReady();transferStatus=status==null?"":status;}
    public static void transferResult(String status){transferStatus=status==null?"":status;}
    public static boolean autoTransferAllowed(){return autoTransferEnabled&&autoTransferReady()&&foreground&&backendReady&&connected();}
    public static void configureQuickBall(boolean configured) {
        synchronized(quickBallLock) {
            quickBallConfigured=configured; quickBallReady=false; setThrowReady(false);setMapTapReady(false);
            quickBallStatus=configured ? "Checking successful ball animation support" : "";
            quickBallOutcomeToken++;
        }
        main.post(Control::cancelQuickBallToast);
    }
    public static boolean quickBallConfigured() { return quickBallConfigured; }
    public static boolean quickBallReady() { return quickBallConfigured && quickBallReady; }
    public static boolean quickBallEnabled() { return quickBallEnabled; }
    public static String quickBallStatus() { return quickBallStatus; }
    public static void setQuickBallReady(boolean ready,String status) {
        boolean disabled;
        synchronized(quickBallLock) {
            quickBallReady=quickBallConfigured && ready;
            disabled=quickBallEnabled && !quickBallReady;
            if(!quickBallReady){setThrowReady(false);setMapTapReady(false);}
            String text=status==null || status.length()==0 ? (quickBallReady ? "Ready" : "Unavailable") : status;
            quickBallStatus=quickBallConfigured ? text.substring(0,Math.min(text.length(),320)) : "";
        }
        if(!ready)invalidateQuickBallOutcome();
        if(disabled)event("quick-ball-setting","Suspended; saved choice retained");
    }
    public static void setQuickBallEnabled(boolean enabled) {
        boolean changed,actual;
        synchronized(quickBallLock) {
            actual=enabled;
            changed=quickBallEnabled!=actual; quickBallEnabled=actual;
        }
        if(!actual)invalidateQuickBallOutcome();
        saveSettings();
        if(changed)event("quick-ball-setting",actual ? "ON; experimental 20x catch and break-free ball animation; summary screens remain" : "OFF");
    }
    public static boolean quickBallAllowed() {
        return quickBallEnabled && quickBallReady && foreground && backendReady && connected();
    }
    public static boolean mapTapReady() { return quickBallReady() && mapTapReady; }
    public static void setMapTapReady(boolean ready) { mapTapReady=ready; if(!ready)mapTapEpoch++; }
    public static int mapTapMode() { return mapTapMode; }
    public static int mapTapEpoch() { return mapTapEpoch; }
    public static void setMapTapMode(int mode) { mapTapEpoch++; mapTapMode=mode>=0 && mode<=2 ? mode : 0; saveSettings(); event("map-tap-mode",""+mapTapMode); }
    public static boolean mapTapAllowed() { return mapTapMode!=0 && mapTapReady() && foreground && backendReady && connected(); }
    public static void applyMapTap(double latitude,double longitude,int mode,int epoch,double sampledAt) {
        double age=SystemClock.elapsedRealtime()-sampledAt;
        if(!Double.isFinite(age)||age<0||age>750)return;
        if(!Double.isFinite(latitude)||!Double.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return;
        final long received=SystemClock.elapsedRealtime();
        main.post(() -> {
            if(!mapTapAllowed()||mode!=mapTapMode||epoch!=mapTapEpoch||SystemClock.elapsedRealtime()-received>750)return;
            if(mode==1)walkTo(latitude,longitude);else if(mode==2)teleport(latitude,longitude);else return;
            event("map-tap-applied",String.format(Locale.US,"mode=%d lat=%.7f lon=%.7f",mode,latitude,longitude));
        });
    }
    public static boolean throwReady() { return quickBallReady() && throwReady; }
    public static void setThrowReady(boolean ready) { throwReady=ready; }
    public static int throwGrade() { return throwGrade; }
    public static boolean throwCurve() { return throwCurve; }
    public static boolean throwAr() { return throwAr; }
    public static boolean throwArReady() { return throwArReady && throwReady(); }
    public static void setThrowArReady(boolean value) { throwArReady=value; }
    public static void setThrowAr(boolean value) { throwAr=value; saveSettings(); }

    public static void setThrowGrade(int grade) { throwGrade=grade>=0 && grade<=3 ? grade : 0; saveSettings(); event("throw-grade",""+throwGrade); }
    public static void setThrowCurve(boolean enabled) { throwCurve=enabled; saveSettings(); event("throw-curve",""+throwCurve); }
    public static boolean throwAllowed() { return throwReady() && foreground && backendReady && connected(); }
    /** Visible text for a natively confirmed outcome; anything else is rejected. */
    static String quickBallOutcomeText(String outcome) {
        if("transferred".equals(outcome))return "Transferred";
        if("transfer-error".equals(outcome))return "Transfer Error";
        if("caught".equals(outcome))return "Caught";
        if("broke-free".equals(outcome))return "Not caught - broke free";
        if("fled".equals(outcome))return "Not caught - fled";
        return null;
    }
    /**
     * Queues one short toast while the feature is active in the foreground. The
     * gate is checked again on the main thread; a newer outcome or any OFF,
     * readiness, background or connection change discards queued work.
     * Logs record request/suppression only, never that the user saw the toast.
     */
    private static boolean outcomeAllowed(String outcome) { return ("transferred".equals(outcome)||"transfer-error".equals(outcome)) ? autoTransferAllowed() : quickBallAllowed(); }
    public static boolean quickBallOutcome(String outcome) {
        final String text=quickBallOutcomeText(outcome);
        if(text==null) { event("quick-ball-toast","suppressed; unsupported outcome"); return false; }
        final long token;
        synchronized(quickBallLock) { token=outcomeAllowed(outcome) ? ++quickBallOutcomeToken : -1; }
        if(token<0) { event("quick-ball-toast","suppressed outcome="+outcome+"; feature not active in foreground"); return false; }
        event("quick-ball-toast","received outcome="+outcome+"; queued for display");
        if(main.post(() -> showQuickBallOutcome(token,outcome,text))) return true;
        event("quick-ball-toast","suppressed outcome="+outcome+"; main thread unavailable");
        return false;
    }
    private static void showQuickBallOutcome(long token,String outcome,String text) {
        String reason=null;
        synchronized(quickBallLock) {
            if(token!=quickBallOutcomeToken) reason="superseded or turned off";
            else if(!outcomeAllowed(outcome)) reason="feature not active in foreground";
        }
        Activity activity=pad==null ? null : pad.activity;
        if(reason==null && (activity==null || activity.isFinishing() || activity.isDestroyed())) reason="no resumed game screen";
        if(reason!=null) { event("quick-ball-toast","suppressed outcome="+outcome+"; "+reason); return; }
        try {
            cancelQuickBallToast();
            quickBallToast=Toast.makeText(activity,text,Toast.LENGTH_SHORT);
            quickBallToast.show();
            event("quick-ball-toast","displayed outcome="+outcome+"; Toast.show requested, user visibility unverified");
        } catch(RuntimeException error) {
            quickBallToast=null;
            event("quick-ball-toast","suppressed outcome="+outcome+"; toast error "+error.getClass().getSimpleName());
        }
    }
    private static void invalidateQuickBallOutcome() {
        synchronized(quickBallLock) { quickBallOutcomeToken++; }
        main.post(Control::cancelQuickBallToast);
    }
    private static void cancelQuickBallToast() {
        Toast toast=quickBallToast; quickBallToast=null;
        if(toast!=null) try { toast.cancel(); } catch(RuntimeException ignored) {}
    }
    public static void configureInteractionDiagnostics(boolean configured) {
        interactionDiagnosticsConfigured=configured; interactionDiagnosticRunning=false;
        interactionTraceRequest.set(false); interactionStopRequest.set(false);
        interactionDiagnosticStatus=configured ? "Catch/spin diagnostics: checking metadata shortly" : "";
    }
    public static boolean interactionDiagnosticsConfigured() { return interactionDiagnosticsConfigured; }
    public static boolean interactionDiagnosticsReady() { return interactionDiagnosticsConfigured && foreground && backendReady && connected(); }
    public static boolean interactionDiagnosticRunning() { return interactionDiagnosticRunning; }
    public static boolean interactionTracePending() { return interactionTraceRequest.get(); }
    public static String interactionDiagnosticStatus() { return interactionDiagnosticStatus; }
    public static void interactionDiagnostic(String text) {
        if (!interactionDiagnosticsConfigured) return;
        interactionDiagnosticStatus=text==null ? "" : text.substring(0,Math.min(text.length(),320));
    }
    public static void setInteractionDiagnosticRunning(boolean running) { interactionDiagnosticRunning=running && interactionDiagnosticsConfigured; }
    public static boolean requestInteractionTrace() {
        if (!interactionDiagnosticsReady() || interactionDiagnosticRunning || interactionTraceRequest.get()) return false;
        engine.stop(); saveState(); interactionStopRequest.set(false); interactionTraceRequest.set(true);
        interactionDiagnosticStatus="Capture requested; waiting for observer";
        event("interaction-trace-requested","Stationary capture for60s; fasterSummary="+quickSummaryEnabled());
        return true;
    }
    public static boolean takeInteractionTraceRequest() { return interactionTraceRequest.getAndSet(false) && interactionDiagnosticsReady() && !interactionDiagnosticRunning; }
    public static void requestInteractionStop() { interactionTraceRequest.set(false); interactionStopRequest.set(true); }
    public static boolean takeInteractionStopRequest() { return interactionStopRequest.getAndSet(false) || (interactionDiagnosticRunning && !interactionDiagnosticsReady()); }
    public static boolean desiredEnabled() { return desiredEnabled; }
    public static void configureCameraSteering(boolean configured) {
        synchronized (cameraHeading) {
            cameraSteeringConfigured=configured;
            cameraHeading.invalidate(); stopManualMotion();
        }
    }
    public static boolean cameraSteeringConfigured() { return cameraSteeringConfigured; }
    /** Camera-relative is the only joystick mode; unavailable headings stop input. */
    public static boolean cameraRelative() { return true; }
    public static boolean cameraSteeringRequested() {
        return cameraSteeringConfigured && foreground && backendReady && connected();
    }
    public static void updateCameraHeading(double yawDegrees, int cameraId, boolean mapVisible, long ageMillis) {
        synchronized (cameraHeading) {
            long now=SystemClock.elapsedRealtime();
            long sampledAt=ageMillis>=0 && ageMillis<=now ? now-ageMillis : -1;
            updateCameraHeadingLocked(yawDegrees,cameraId,mapVisible,sampledAt,now);
        }
    }
    /** Native CLOCK_BOOTTIME timestamp, rounded down; includes bridge and heading-lock delay. */
    public static void updateCameraHeadingAt(double yawDegrees, int cameraId, boolean mapVisible, long sampledAtMillis) {
        synchronized (cameraHeading) {
            updateCameraHeadingLocked(yawDegrees,cameraId,mapVisible,sampledAtMillis,SystemClock.elapsedRealtime());
        }
    }
    private static void updateCameraHeadingLocked(double yawDegrees,int cameraId,boolean mapVisible,long sampledAtMillis,long now) {
        buddyMapSample=mapVisible&&sampledAtMillis>0&&sampledAtMillis<=now&&now-sampledAtMillis<1500?sampledAtMillis:0;
        // Expiry is checked before replacement, even if no UI tick observed the gap.
        CameraHeadingState.Sample previous=cameraHeading.sample(now);
        boolean accepted=cameraSteeringRequested() && cameraHeading.updateAt(yawDegrees,cameraId,mapVisible,sampledAtMillis,now);
        if (!accepted) cameraHeading.invalidate();
        CameraHeadingState.Sample current=cameraHeading.sample(now);
        if (cameraRelative() && (!previous.valid || !current.valid || previous.generation!=current.generation)) stopManualMotion();
    }
    public static void invalidateCameraHeading(String reason) {
        buddyMapSample=0;
        synchronized (cameraHeading) {
            cameraHeading.invalidate();
            if (cameraRelative()) stopManualMotion();
        }
    }
    private static void stopManualMotion() { synchronized (engine) { if (!engine.walking) engine.stop(); } }
    static long beginCameraGesture() {
        synchronized (cameraHeading) {
            return cameraSteeringRequested() ? cameraHeading.beginGesture(SystemClock.elapsedRealtime()) : -1;
        }
    }
    /** Heading validation and input assignment share a lock with asynchronous invalidation. */
    static boolean applyCameraInput(long gesture, double right, double up, long now) {
        synchronized (cameraHeading) {
            CameraSteering.Direction direction=cameraHeading.direction(gesture,right,up,now);
            if (!cameraSteeringRequested() || !direction.valid) { stopManualMotion(); return false; }
            engine.input(direction.east,direction.north); return true;
        }
    }
    static String cameraSteeringStatus() {
        synchronized (cameraHeading) {
            CameraHeadingState.Sample sample=cameraHeading.sample(SystemClock.elapsedRealtime());
            if (!cameraSteeringRequested() || !sample.valid) {
                if (cameraRelative()) stopManualMotion();
                return "Waiting for camera; release and drag again";
            }
            return String.format(Locale.US,"Camera heading %.0f\u00b0; up follows the view",sample.heading);
        }
    }
    public static void configureCameraDiagnostics(boolean configured) {
        cameraDiagnosticsConfigured = configured;
        cameraSampleRequest.set(false);
        cameraDiagnosticRunning = false;
        cameraDiagnosticStatus = configured ? "Camera diagnostic ready" : "";
    }
    public static boolean cameraDiagnosticsConfigured() { return cameraDiagnosticsConfigured; }
    public static boolean cameraDiagnosticsReady() { return cameraDiagnosticsConfigured && foreground && backendReady && connected(); }
    public static boolean cameraSamplePending() { return cameraSampleRequest.get() || cameraDiagnosticRunning; }
    public static boolean cameraDiagnosticRunning() { return cameraDiagnosticRunning; }
    public static void setCameraDiagnosticRunning(boolean running) { cameraDiagnosticRunning = running && cameraDiagnosticsConfigured; }
    public static String cameraDiagnosticStatus() { return cameraDiagnosticStatus; }
    public static boolean requestCameraSample() {
        if (!cameraDiagnosticsReady() || cameraSamplePending()) return false;
        if (engine.walking) event("walk-cancelled", "Camera diagnostic requested");
        engine.stop(); saveState();
        cameraDiagnosticStatus = "Camera sample requested (10s)";
        cameraSampleRequest.set(true);
        event("camera-sample-requested", "Stationary sample; desiredEnabled=" + desiredEnabled + "; location override preference unchanged");
        return true;
    }
    public static boolean takeCameraSampleRequest() {
        boolean requested = cameraSampleRequest.getAndSet(false);
        return requested && cameraDiagnosticsReady() && !cameraDiagnosticRunning;
    }
    public static void cameraDiagnostic(String text) {
        if (!cameraDiagnosticsConfigured) return;
        if (text == null || text.length() == 0) text = "Camera diagnostic ready";
        cameraDiagnosticStatus = text.length() > 320 ? text.substring(0, 320) : text;
    }
    public static boolean canEnable() { return connected() && (preview || backendReady); }
    public static void connect() {
        engine.pause();
        invalidateCameraHeading("Adapter reconnecting");
        preview = false; backendReady = true;
        instrumented = true;
        connection = "Java location adapter - game acceptance unverified";
        renewLease();
        main.post(() -> restoreRuntime("backend-ready"));
    }
    public static void renewLease() {
        leaseDeadline = android.os.SystemClock.elapsedRealtime() + 8000;
        if(leaseExpired) {
            leaseExpired=false; connection="Java location adapter - game acceptance unverified";
            main.post(() -> { restoreRuntime("heartbeat-restored"); event("heartbeat-restored","Saved preference restored stationary; desiredEnabled="+desiredEnabled); });
        }
    }
    public static void checkLease() {
        if(!connected() && !leaseExpired) { leaseExpired=true; cameraSampleRequest.set(false); invalidateQuickBallOutcome(); invalidateCameraHeading("Connection lost"); engine.pause(); saveState(); connection="Adapter heartbeat late - suspended"; event("heartbeat-expired","Runtime suspended; saved enabled preference unchanged"); }
    }
    public static boolean connected() { return !instrumented || android.os.SystemClock.elapsedRealtime() <= leaseDeadline; }
    public static synchronized void begin(Application app) {
        if (registered) return;
        registered = true;
        vgpApplication=app;
        try {
            File dir = new File(app.getFilesDir(), "pgrazor-logs");
            if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Cannot create log folder");
            logFile = new File(dir, new SimpleDateFormat("yyyyMMdd-HHmmss-SSS", Locale.US).format(new Date()) + ".txt");
            log = new PrintWriter(new FileOutputStream(logFile), true);
        } catch (IOException error) { Log.e("PGRazor", "File logging unavailable", error); }
        // Recover recent run tails after a crash without changing or deleting private originals.
        new Thread(() -> recoverRunLogs(app),"pgrazor-log-recovery").start();
        event("session-start", connection);
        loadState(app);
        loadSettings(app);
        Cooldown.init(app);
        app.registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks() {
            public void onActivityResumed(Activity activity) { attach(activity); }
            public void onActivityPaused(Activity activity) {
                if (pad != null && pad.activity == activity) { pad.close(); pad = null; }
            }
            public void onActivityDestroyed(Activity activity) {
                if (pad != null && pad.activity == activity) { pad.close(); pad = null; }
            }
            public void onActivityCreated(Activity a, Bundle b) {}
            public void onActivityStarted(Activity a) {}
            public void onActivityStopped(Activity a) {}
            public void onActivitySaveInstanceState(Activity a, Bundle b) {}
        });
    }
    public static void attach(Activity activity) {
        if (activity instanceof LogActivity) return;
        if (activity.isFinishing() || activity.isDestroyed()) return;
        if (pad != null && pad.activity == activity) return;
        if (pad != null) pad.close();
        foreground = true;
        restoreRuntime("foreground");
        try { pad = new Pad(activity); event("panel-ready", activity.getClass().getName()); }
        catch (RuntimeException error) { suspendForBackground(); event("panel-error", error.toString()); }
    }
    public static void disconnect() {
        engine.pause(); backendReady = false;
        setQuickSummaryReady(false,"Catch summary support disconnected");
        setQuickBallReady(false,"Ball animation support disconnected");
        invalidateCameraHeading("Adapter disconnected");
        cameraSampleRequest.set(false);
        cameraDiagnosticRunning = false;
        if (cameraDiagnosticsConfigured) cameraDiagnosticStatus = "Camera diagnostic unavailable: adapter disconnected";
        saveState();
        connection = "DISCONNECTED - location override off";
        event("disconnected", "Runtime suspended; saved enabled preference unchanged");
    }

    public static void teleport(double latitude, double longitude) {
        engine.position(latitude, longitude); engine.stop();
        engine.enabled = foreground && canEnable();
        saveState();
    }
    public static void walkTo(double latitude, double longitude) {
        engine.walkTo(latitude, longitude);
        if (!foreground || !canEnable()) engine.pause();
        saveState();
    }
    public static void walkRoute(double[][] waypoints) { walkRoute(waypoints, false); }
    /** As {@link #walkRoute(double[][])}, but a looping route repeats from its first stop; same lifecycle/save/readiness. */
    public static void walkRoute(double[][] waypoints, boolean loop) {
        engine.walkRoute(waypoints, loop);
        if (!foreground || !canEnable()) engine.pause();
        saveState();
    }
    public static void startAutoWalk(double[][] waypoints,boolean loop) {
        if(!foreground||!canEnable())throw new IllegalArgumentException("Location adapter is not ready");
        engine.walkRoute(waypoints,loop);saveState();
        event("autowalk-started","stops="+waypoints.length+" loop="+loop+" speed="+engine.speedKmh);
    }
    public static double cycleWalkSpeed() {
        double[] presets={0,9.3,16,30};double next=0;
        synchronized(engine){for(int i=0;i<presets.length;i++)if(Math.abs(engine.speedKmh-presets[i])<0.001){next=presets[(i+1)%presets.length];break;}engine.speed(next);}
        saveState();return next;
    }
    public static void suspendForBackground() {
        requestInteractionStop();
        foreground = false; autoWalkPlanning=false;mapPoiOpen=false;mapPoiSnapshot="";mapPoiAt=0; mapTapEpoch++; invalidateQuickBallOutcome(); cameraSampleRequest.set(false); invalidateCameraHeading("App backgrounded");
        // Losing the foreground switches VGP off, clears any target, and never auto-resumes.
        synchronized(vgpLock){vgpEnabled=false;vgpTargetAt=0;vgpGuardReason="App left foreground; tap VGP to start";}
        engine.pause(); saveState();
    }
    private static void restoreRuntime(String reason) {
        if (!registered) return;
        LocationState.capture(engine, desiredEnabled).restoreStationary(engine, canEnable(), foreground);
        event("state-activation", reason + "; desiredEnabled=" + desiredEnabled + "; runtimeEnabled=" + engine.enabled + "; stationary");
    }

    /** A moving checkpoint is queued at most once per second; explicit controls call saveState directly. */
    public static void checkpoint(long now) {
        if (now - lastCheckpoint < 1000) return;
        lastCheckpoint = now;
        if (!checkpointPending.compareAndSet(false, true)) return;
        stateWriter.execute(() -> { try { saveState(); } finally { checkpointPending.set(false); } });
    }
    public static void saveState() {
        synchronized (stateLock) {
            if (stateFile == null) return;
            FileOutputStream out = null;
            StrictMode.ThreadPolicy policy = StrictMode.allowThreadDiskWrites();
            try {
                String encoded = LocationState.capture(engine, desiredEnabled).encode();
                if (encoded.equals(lastSaved)) return;
                out = stateFile.startWrite();
                out.write(encoded.getBytes(StandardCharsets.UTF_8));
                stateFile.finishWrite(out); out = null;
                lastSaved = encoded;
                if (stateWriteFailed) { stateWriteFailed = false; event("state-save-restored", "Location checkpoints are being saved again"); }
            } catch (IOException | RuntimeException error) {
                if (out != null) stateFile.failWrite(out);
                if (!stateWriteFailed) { stateWriteFailed = true; event("state-save-error", error.toString()); }
            } finally { StrictMode.setThreadPolicy(policy); }
        }
    }
    private static void loadState(Application app) {
        synchronized (stateLock) {
            stateFile = new AtomicFile(new File(app.getFilesDir(), "pgrazor-location-state-v1.txt"));
            LocationState state = LocationState.defaults();
            String source = "defaults";
            StrictMode.ThreadPolicy policy = StrictMode.allowThreadDiskReads();
            try (FileInputStream in = stateFile.openRead()) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] buffer = new byte[LocationState.MAX_RECORD_LENGTH + 1];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    bytes.write(buffer, 0, read);
                    if (bytes.size() > LocationState.MAX_RECORD_LENGTH) throw new IOException("Oversized location state");
                }
                state = LocationState.decode(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
                lastSaved = state.encode(); source = "saved";
            } catch (FileNotFoundException missing) {
                // First install has an enabled preference, but runtime remains gated by readiness.
            } catch (IOException | RuntimeException error) {
                event("state-load-error", "Using defaults: " + error);
            } finally { StrictMode.setThreadPolicy(policy); }
            // Location override is always requested; old paused snapshots cannot disable it.
            state.restoreStationary(engine, false, false);
            event("state-restored", String.format(Locale.US,"source=%s lat=%.7f lon=%.7f speedKmh=%.2f bearing=%.2f desiredEnabled=%s; awaiting ready foreground; movement stopped",source,state.latitude,state.longitude,state.speedKmh,state.bearing,desiredEnabled));
        }
        saveState();
    }
    private static boolean darkTheme=true, joystickVisible=true;
    public static boolean darkTheme(){return darkTheme;}
    public static boolean joystickVisible(){return joystickVisible;}
    public static void setDarkTheme(boolean value){darkTheme=value;saveSettings();}
    public static void setJoystickVisible(boolean value){joystickVisible=value;saveSettings();}
    private static void loadSettings(Application app) {
        synchronized(stateLock) {
            settingsFile=new AtomicFile(new File(app.getFilesDir(),"pgrazor-settings-v1.properties"));
            StrictMode.ThreadPolicy policy=StrictMode.allowThreadDiskReads();
            try(FileInputStream in=settingsFile.openRead()) {
                Properties p=new Properties(); p.load(in);
                darkTheme=Boolean.parseBoolean(p.getProperty("darkTheme","true"));
                joystickVisible=Boolean.parseBoolean(p.getProperty("joystickVisible","true"));
                cooldownOverlay=Boolean.parseBoolean(p.getProperty("cooldownOverlay","false"));
                quickSummaryEnabled=Boolean.parseBoolean(p.getProperty("autoDismiss","false"));
                spawnBooster=Boolean.parseBoolean(p.getProperty("spawnBooster","false"));
                try{giftOptions=Integer.parseInt(p.getProperty("giftOptions","0"));}catch(NumberFormatException ignored){giftOptions=0;}
                if(giftOptions<0||giftOptions>7)giftOptions=0;
                // VGP active state is runtime only: always start OFF, ignoring any legacy persisted vgpEnabled.
                autoIncubate=Boolean.parseBoolean(p.getProperty("autoIncubate","false"));
                incubateLongest=Boolean.parseBoolean(p.getProperty("incubateLongest","false"));
                vgpEnabled=false;vgpTargetAt=0;
                vgpOverlay=Boolean.parseBoolean(p.getProperty("vgpOverlay","false"));
                vgpStopOnCooldown=Boolean.parseBoolean(p.getProperty("vgpStopOnCooldown","false"));
                try{vgpOptions=Integer.parseInt(p.getProperty("vgpOptions","3"))&7;}catch(NumberFormatException ignored){vgpOptions=3;}
                try{buddyBerry=Integer.parseInt(p.getProperty("buddyBerry","0"));}catch(NumberFormatException ignored){buddyBerry=0;}
                if(buddyBerry!=701&&buddyBerry!=703&&buddyBerry!=705&&buddyBerry!=706&&buddyBerry!=707)buddyBerry=0;
                try{autoBerry=Integer.parseInt(p.getProperty("autoBerry","0"));}catch(NumberFormatException ignored){autoBerry=0;}
                if(autoBerry!=701&&autoBerry!=703&&autoBerry!=705&&autoBerry!=706&&autoBerry!=707)autoBerry=0;
                // Migration: installs that had an active berry keep the overlay enabled; otherwise it defaults off.
                encounterBerryEnabled=Boolean.parseBoolean(p.getProperty("encounterBerry",String.valueOf(autoBerry!=0)));
                try{battleOptions=Integer.parseInt(p.getProperty("battleOptions","0"));}catch(NumberFormatException ignored){battleOptions=0;}
                if(battleOptions<0||battleOptions>1023)battleOptions=0;
                try{rocketOptions=Integer.parseInt(p.getProperty("rocketOptions","0"));}catch(NumberFormatException ignored){rocketOptions=0;}
                if(rocketOptions<0||rocketOptions>7)rocketOptions=0;
                itemTransferEnabled=Boolean.parseBoolean(p.getProperty("itemTransfer","false"));
                itemRules=p.getProperty("itemRules","");itemLimits=p.getProperty("itemLimits","");itemCatalog=p.getProperty("itemCatalog","");
                if(!validItemRules(itemRules)||!validItemRules(itemLimits)){itemTransferEnabled=false;itemRules="";itemLimits="";}
                quickSpinEnabled=Boolean.parseBoolean(p.getProperty("quickSpin","false"));
                try{autoEngine=Integer.parseInt(p.getProperty("autoEngine","0"));}catch(NumberFormatException ignored){autoEngine=0;}
                if(autoEngine!=0&&autoEngine!=1)autoEngine=0;
                nativeCatch=Boolean.parseBoolean(p.getProperty("nativeCatch","false"));
                nativeSpin=Boolean.parseBoolean(p.getProperty("nativeSpin","false"));
                if(autoEngine==0){nativeCatch=false;nativeSpin=false;}
                try{nativeBalls=Integer.parseInt(p.getProperty("nativeBalls","1"));}catch(NumberFormatException ignored){nativeBalls=1;}
                if(nativeBalls<1||nativeBalls>7)nativeBalls=1;
                try{nativeBerry=Integer.parseInt(p.getProperty("nativeBerry","0"));}catch(NumberFormatException ignored){nativeBerry=0;}
                if(!berryChoice(nativeBerry))nativeBerry=0;
                nativeCurve=Boolean.parseBoolean(p.getProperty("nativeCurve","true"));
                try{nativeGrade=Integer.parseInt(p.getProperty("nativeGrade","3"));}catch(NumberFormatException ignored){nativeGrade=3;}
                if(nativeGrade<0||nativeGrade>3)nativeGrade=3;
                nativeScreenFree=Boolean.parseBoolean(p.getProperty("nativeScreenFree","false"));
                gymFeedEnabled=Boolean.parseBoolean(p.getProperty("gymFeed","false"));
                try{gymFeedBerry=Integer.parseInt(p.getProperty("gymFeedBerry","0"));}catch(NumberFormatException ignored){gymFeedBerry=0;}
                if(!berryChoice(gymFeedBerry))gymFeedBerry=0;
                claimResearch=Boolean.parseBoolean(p.getProperty("claimResearch","false"));
                try{researchRules=normalizeResearchRules(p.getProperty("researchRules",""));}catch(IllegalArgumentException invalid){researchRules="";claimResearch=false;}
                autoTransferEnabled=Boolean.parseBoolean(p.getProperty("autoTransfer","false"));
                try { transferProtect=Integer.parseInt(p.getProperty("transferProtect","63")); if(transferProtect<0||transferProtect>63)transferProtect=63; } catch(NumberFormatException e){transferProtect=63;}
                // Migrate the former independent animation preference to Quick Catch.
                quickBallEnabled=quickSummaryEnabled;
                throwCurve=Boolean.parseBoolean(p.getProperty("curve","false"));
                throwAr=Boolean.parseBoolean(p.getProperty("throwAr","false"));
                throwGrade=boundedSetting(p,"grade",3); mapTapMode=boundedSetting(p,"mapTap",2);
                event("settings-restored","dismiss="+quickSummaryEnabled+" fastBall="+quickBallEnabled+" grade="+throwGrade+" curve="+throwCurve+" mapTap="+mapTapMode+" engine="+autoEngineName()+" nativeCatch="+nativeCatch+" nativeSpin="+nativeSpin+" gymFeed="+gymFeedEnabled+" claimResearch="+claimResearch+" cameraRelative=true");
            } catch(FileNotFoundException missing) {
                // Defaults apply only until the user first saves a choice.
            } catch(IOException | RuntimeException error) { event("settings-load-error",error.toString()); }
            finally { StrictMode.setThreadPolicy(policy); }
        }
    }
    private static int boundedSetting(Properties p,String key,int max) {
        try { int n=Integer.parseInt(p.getProperty(key,"0")); return n>=0&&n<=max?n:0; }
        catch(NumberFormatException invalid) { return 0; }
    }
    static Properties exportSettings() throws IOException {
        synchronized(stateLock) {
            saveSettings();
            Properties p=new Properties();
            if(settingsFile==null)throw new IOException("Settings are not ready");
            try(FileInputStream in=settingsFile.openRead()){p.load(in);}
            return p;
        }
    }
    static void importSettings(Application app,Properties incoming,double speed) throws IOException {
        synchronized(stateLock) {
            Properties merged=exportSettings();merged.putAll(incoming);
            FileOutputStream out=null;
            try{out=settingsFile.startWrite();merged.store(out,"PGRazor settings");settingsFile.finishWrite(out);out=null;}
            finally{if(out!=null)settingsFile.failWrite(out);}
            loadSettings(app); // Restores preferences and explicitly leaves VGP off.
            engine.stop();engine.speed(speed);saveState(); // Keep current coordinates; never resume a route.
        }
    }
    private static void saveSettings() {
        synchronized(stateLock) {
            if(settingsFile==null)return;
            StrictMode.ThreadPolicy policy=StrictMode.allowThreadDiskWrites(); FileOutputStream out=null;
            try {
                Properties p=new Properties();
                p.setProperty("darkTheme",String.valueOf(darkTheme));
                p.setProperty("joystickVisible",String.valueOf(joystickVisible));
                p.setProperty("spawnBooster",String.valueOf(spawnBooster));
                p.setProperty("giftOptions",String.valueOf(giftOptions));
                p.setProperty("vgpOverlay",String.valueOf(vgpOverlay));
                p.setProperty("vgpStopOnCooldown",String.valueOf(vgpStopOnCooldown));
                p.setProperty("vgpOptions",String.valueOf(vgpOptions));
                p.setProperty("buddyBerry",String.valueOf(buddyBerry));
                p.setProperty("autoIncubate",String.valueOf(autoIncubate));
                p.setProperty("incubateLongest",String.valueOf(incubateLongest));
                p.setProperty("cooldownOverlay",String.valueOf(cooldownOverlay));p.setProperty("autoBerry",String.valueOf(autoBerry));
                p.setProperty("encounterBerry",String.valueOf(encounterBerryEnabled));
                p.setProperty("battleOptions",String.valueOf(battleOptions));
                p.setProperty("rocketOptions",String.valueOf(rocketOptions));
                p.setProperty("itemTransfer",String.valueOf(itemTransferEnabled));p.setProperty("itemRules",itemRules);p.setProperty("itemLimits",itemLimits);p.setProperty("itemCatalog",itemCatalog);
                p.setProperty("quickSpin",String.valueOf(quickSpinEnabled));
                p.setProperty("autoEngine",String.valueOf(autoEngine));
                p.setProperty("nativeCatch",String.valueOf(nativeCatch));p.setProperty("nativeSpin",String.valueOf(nativeSpin));
                p.setProperty("nativeBalls",String.valueOf(nativeBalls));p.setProperty("nativeBerry",String.valueOf(nativeBerry));
                p.setProperty("nativeCurve",String.valueOf(nativeCurve));p.setProperty("nativeGrade",String.valueOf(nativeGrade));
                p.setProperty("nativeScreenFree",String.valueOf(nativeScreenFree));
                p.setProperty("gymFeed",String.valueOf(gymFeedEnabled));p.setProperty("gymFeedBerry",String.valueOf(gymFeedBerry));
                p.setProperty("claimResearch",String.valueOf(claimResearch));p.setProperty("researchRules",researchRules);
                p.setProperty("autoTransfer",String.valueOf(autoTransferEnabled)); p.setProperty("transferProtect",String.valueOf(transferProtect));
                p.setProperty("autoDismiss",String.valueOf(quickSummaryEnabled)); p.setProperty("fastBall",String.valueOf(quickBallEnabled));
                p.setProperty("throwAr",String.valueOf(throwAr)); p.setProperty("curve",String.valueOf(throwCurve)); p.setProperty("grade",String.valueOf(throwGrade));
                p.setProperty("mapTap",String.valueOf(mapTapMode));
                out=settingsFile.startWrite(); p.store(out,"PGRazor settings"); settingsFile.finishWrite(out); out=null;
            } catch(IOException | RuntimeException error) { if(out!=null)settingsFile.failWrite(out); event("settings-save-error",error.toString()); }
            finally { StrictMode.setThreadPolicy(policy); }
        }
    }
    public static void event(String kind, String detail) {
        synchronized (logLock) {
            String line = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).format(new Date()) + " [" + kind + "] " + detail;
            Log.i("PGRazor", line);
            if (log != null) log.println(line);
        }
    }
    private static void recoverRunLogs(Application app) {
        try {
            File[] files=new File(app.getFilesDir(),"pgrazor-logs").listFiles((dir,name)->name.endsWith(".txt"));
            File destination=app.getExternalFilesDir("pgrazor-diagnostics");
            if(files==null||destination==null)return;
            if(!destination.isDirectory()&&!destination.mkdirs())return;
            java.util.Arrays.sort(files,(a,b)->b.getName().compareTo(a.getName()));
            int count=0;
            for(File source:files){
                if(source.equals(logFile))continue;
                if(count++>=6)break;
                try(RandomAccessFile in=new RandomAccessFile(source,"r");FileOutputStream out=new FileOutputStream(new File(destination,source.getName()))){
                    long remaining=Math.min(in.length(),524288L);in.seek(in.length()-remaining);
                    byte[] buffer=new byte[8192];
                    while(remaining>0){int n=in.read(buffer,0,(int)Math.min(buffer.length,remaining));if(n<0)break;out.write(buffer,0,n);remaining-=n;}
                }
            }
            event("log-recovery","Recent run tails saved to app external diagnostics directory");
        }catch(IOException|RuntimeException error){event("log-recovery-error",error.toString());}
    }
    public static File currentLog() { return logFile; }
    public static boolean active() { return foreground && backendReady && connected() && engine.enabled; }
    public static double latitude() { latitudeReads++; return engine.latitude; }
    public static double longitude() { longitudeReads++; return engine.longitude; }
    public static float speed() { return (float)engine.metersPerSecond(); }
    public static float bearing() { return (float)engine.bearing; }
}
