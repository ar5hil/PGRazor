package dev.pgrazor;

/** Two separate JVM processes verify saved choices survive a cold start. */
public final class ControlSettingsTest {
    public static void main(String[] args) throws Exception {
        android.app.Application app=new android.app.Application() {
            public java.io.File getFilesDir(){return new java.io.File(args[1]);}
        };
        java.lang.reflect.Method load=Control.class.getDeclaredMethod("loadSettings",android.app.Application.class);
        load.setAccessible(true); load.invoke(null,app);
        Control.configureQuickBall(true); Control.configureQuickSummary(true); Control.configureCameraSteering(true);
        if(args[0].equals("save")) {
            Control.setGiftOptions(7);
            Control.setSpawnBooster(true);
            Control.setAutoBerry(705); Control.setBuddyBerry(703);
            Control.setBattleOptions(981);
            Control.setRocketOptions(5);
            Control.setItemCatalog("1|Poke Ball|150\n101|Potion|4");
            Control.saveItemRules(true,"1:100;101:0;","1:100;101:0;2:250;");
            try{Control.saveItemRules(true,"1:-1;","");throw new AssertionError("Negative cap accepted");}catch(IllegalArgumentException expected){}
            Control.setQuickSpinEnabled(true); Control.setAutoTransferEnabled(true); Control.setTransferProtect(13);
            Control.setQuickBallEnabled(true); Control.setQuickSummaryEnabled(true);
            Control.setThrowGrade(3); Control.setThrowCurve(true); Control.setMapTapMode(2);
            Control.setAutoEngine(1);
            if(Control.vgpEnabled())throw new AssertionError("Native engine did not stop VGP");
            Control.setNativeCatch(true); Control.setNativeSpin(true);
            Control.setNativeBalls(5); Control.setNativeBerry(705);
            Control.setNativeCurve(false); Control.setNativeGrade(2); Control.setNativeScreenFree(true);
            Control.setGymFeedEnabled(true); Control.setGymFeedBerry(703);
            Control.setResearchOptions(true,"Catch 3 Pok\u00e9mon|i:1\n*|p:25");
            Control.setQuickBallReady(false,"Loading"); Control.setQuickSummaryReady(false,"Loading");
        }
        if(!Control.itemTransferEnabled()||!Control.itemRules().equals("1:100;101:0;")||!Control.itemLimits().equals("1:100;101:0;2:250;")||!Control.itemCatalog().contains("Poke Ball"))throw new AssertionError("Item limits not persisted");
        if(!Control.spawnBooster()||Control.spawnAllowed())throw new AssertionError("Spawn persistence/readiness");
        if(Control.giftOptions()!=7||Control.giftsAllowed())throw new AssertionError("Gift persistence/readiness");
        if(Control.buddyBerry()!=703||Control.buddyAllowed())throw new AssertionError("Buddy preference/readiness");
        if(Control.autoBerry()!=705)throw new AssertionError("Berry choice not persisted");
        if(Control.battleOptions()!=981||Control.battlesAllowed())throw new AssertionError("Other battle persistence/readiness");
        if(Control.rocketOptions()!=5||Control.rocketAllowed())throw new AssertionError("Rocket persistence/readiness");
        if(Control.itemAccessAllowed())throw new AssertionError("Item settings bypassed readiness");
        if(!Control.quickSpinEnabled()||!Control.autoTransferEnabled()||Control.transferProtect()!=13||!Control.quickBallEnabled()||!Control.quickSummaryEnabled()||Control.throwGrade()!=3||
           !Control.throwCurve()||Control.mapTapMode()!=2||!Control.cameraRelative())
            throw new AssertionError("Saved settings lost across readiness/configuration/process restart");
        if(Control.autoEngine()!=1||!Control.autoEngineName().equals("Rasiel native")||!Control.nativeCatch()||!Control.nativeSpin()||!Control.autoCatchOn()||!Control.autoSpinOn())
            throw new AssertionError("Native engine state not persisted");
        if(Control.nativeBalls()!=5||Control.nativeBerry()!=705||Control.nativeCurve()||Control.nativeGrade()!=2||!Control.nativeScreenFree())
            throw new AssertionError("Native catch preferences not persisted");
        if(!Control.gymFeedEnabled()||Control.gymFeedBerry()!=703)
            throw new AssertionError("Gym feed preferences not persisted");
        if(!Control.claimResearch()||!Control.researchRules().equals("Catch 3 Pok\u00e9mon|i:1\n*|p:25")||!Control.researchActive())
            throw new AssertionError("Field research preferences not persisted");
        if(Control.nativeAllowed()||Control.gymFeedAllowed()||Control.researchAllowed())
            throw new AssertionError("Native automation bypassed runtime readiness");
        System.out.println("PASS: settings "+args[0]);
    }
}
