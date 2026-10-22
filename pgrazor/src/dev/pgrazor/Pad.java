package dev.pgrazor;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import java.util.Locale;

/** An in-activity panel: no root or system-overlay permission needed. */
public final class Pad {
    final Activity activity;
    private final FrameLayout parent;
    private final LinearLayout panel, body;
    private final ScrollView bodyScroll;
    private final TextView coords;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Stick stick;
    private View launcher, closeIcon, themeIcon;
    private VgpToggle vgpToggle;
    private Switch incubatorSwitch;
    private Button incubatorPriority;
    private TextView incubatorStatus;
    private LinearLayout joystickOverlay;
    private Button encounterBerry, cooldownTimer;
    private TextView vgpActivity;
    private VgpMarker vgpMarker;
    // Draggable, position-persisting handles for the cooldown and VGP overlays.
    private OverlayDrag cooldownDrag, vgpDrag;
    // Primary action and cycle/dialog rows.
    private Button mapTap, throwGrade, itemSettings, cameraSample, interactionCapture;
    private QuickMenu quickMenu;
    // Boolean settings use proper switches.
    private Switch vgpSwitch, joystickSwitch, cooldownSwitch, spawnSwitch, autoTransferSwitch,
        quickSpinSwitch, berrySwitch, quickSummarySwitch, curveSwitch, arSwitch;
    private Switch nativeCatchSwitch,nativeSpinSwitch,nativeCurveSwitch,nativeScreenFreeSwitch,gymFeedSwitch,researchSwitch;
    private Button autoEngineButton,nativeGradeButton,nativeBerryButton,gymBerryButton,researchRulesButton;
    private TextView nativeStatus,gymFeedStatus,researchStatus;
    private final CheckBox[] nativeBallChoices=new CheckBox[3];
    private TextView quickSummaryLabel, vgpStatus;
    private final CheckBox[] vgpChoices=new CheckBox[3];
    private CheckBox vgpCooldownStop;
    // Status / caption lines (muted, readiness driven).
    private TextView state, steeringStatus, spawnStatus, quickSummaryStatus, transferStatus, quickSpinStatus,
        buddyStatus, giftStatus, itemStatus, rocketStatus, battleStatus, quickBallStatus, cameraStatus, interactionStatus;
    // Multi-option groups keep checkboxes / radios.
    private final CheckBox[] transferProtection=new CheckBox[6];
    private final CheckBox[] giftChoices=new CheckBox[3];
    private final CheckBox[] rocketChoices=new CheckBox[3];
    private final CheckBox[] battleChoices=new CheckBox[10];
    private final RadioButton[] buddyChoices=new RadioButton[6];
    // Section roots gated by backend readiness, refreshed without recreation.
    private View catchRoot, buddyRoot, giftRoot, itemsRoot, rocketRoot, battleRoot, quickBallRoot;
    private LinearLayout cameraRoot, interactionRoot;
    private static final int[] BERRY_IDS={0,701,703,705,706,707};
    private static final String[] BERRY_NAMES={"Off","Razz Berry","Nanab Berry","Pinap Berry","Golden Razz Berry","Silver Pinap Berry"};
    private final java.util.List<TextView> sectionHeads=new java.util.ArrayList<>();
    private final java.util.List<TextView> captions=new java.util.ArrayList<>();

    private Context dialogContext(){return new ContextThemeWrapper(activity,Control.darkTheme()?android.R.style.Theme_Material_Dialog_Alert:android.R.style.Theme_Material_Light_Dialog_Alert);}
    private int ink(){return Control.darkTheme()?Color.rgb(235,241,246):Color.rgb(25,35,47);}
    private int muted(){return Control.darkTheme()?Color.rgb(154,171,187):Color.rgb(88,105,121);}
    private int surface(){return Control.darkTheme()?Color.rgb(20,27,37):Color.rgb(249,251,253);}
    private int accent(){return Control.darkTheme()?Color.rgb(69,225,186):Color.rgb(0,116,92);}
    private GradientDrawable rounded(int color,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;}
    private void styleTree(View view){
        if(view instanceof TextView){TextView t=(TextView)view;
            t.setTextColor(new android.content.res.ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{}},new int[]{muted(),ink()}));
            if(!(view instanceof Button))t.setPadding(dp(4),dp(3),dp(4),dp(3));
        }
        if(view instanceof Button){TextView t=(TextView)view;t.setTextSize(14);t.setMinHeight(dp(48));t.setPadding(dp(10),dp(6),dp(10),dp(6));t.setGravity(Gravity.CENTER_VERTICAL|Gravity.START);
            if(!(view instanceof CompoundButton))view.setBackground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x2845e1ba),rounded(Control.darkTheme()?0xff202b39:0xffedf2f6,9),null));
        }
        if(view instanceof CompoundButton)((CompoundButton)view).setButtonTintList(new android.content.res.ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{android.R.attr.state_checked},new int[]{}},new int[]{muted(),accent(),muted()}));
        if(view instanceof Switch){Switch s=(Switch)view;int off=Control.darkTheme()?0xff4a5a6a:0xffb4c2ce;s.setText("");s.setMinHeight(0);s.setPadding(dp(8),0,0,0);
            s.setThumbTintList(new android.content.res.ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{android.R.attr.state_checked},new int[]{}},new int[]{0xff6b7883,accent(),off}));
            s.setTrackTintList(new android.content.res.ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{android.R.attr.state_checked},new int[]{}},new int[]{0x33808080,(accent()&0x00ffffff)|0x66000000,(off&0x00ffffff)|0x55000000}));
        }
        if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++)styleTree(group.getChildAt(i));}
    }
    private void applyTheme(){
        panel.setBackgroundColor(surface());styleTree(panel);
        for(TextView head:sectionHeads){head.setTextColor(accent());head.setTypeface(Typeface.DEFAULT,Typeface.BOLD);}
        for(TextView c:captions)c.setTextColor(muted());
        if(coords!=null)coords.setTextColor(ink());
        if(launcher!=null)launcher.invalidate();
        if(closeIcon!=null)closeIcon.invalidate();
        if(themeIcon!=null){themeIcon.setContentDescription(Control.darkTheme()?"Switch to light theme":"Switch to dark theme");themeIcon.invalidate();}
        if(joystickOverlay!=null){joystickOverlay.setBackground(rounded(Control.darkTheme()?0xd9141b25:0xd9f9fbfd,22));styleTree(joystickOverlay);stick.invalidate();}
        if(encounterBerry!=null){GradientDrawable berryBg=rounded(surface(),16);berryBg.setStroke(dp(1),accent());encounterBerry.setBackground(berryBg);encounterBerry.setTextColor(ink());}
        if(cooldownTimer!=null)cooldownTimer.setBackground(rounded(Control.darkTheme()?0xcc141b25:0xccf1f5f8,12));
        if(quickMenu!=null)quickMenu.applyTheme();
    }
    /** A collapsible group. Content is built directly into the returned container, so no post-hoc index moves. */
    private LinearLayout section(LinearLayout owner,String label,boolean open){
        LinearLayout group=new LinearLayout(activity);group.setOrientation(LinearLayout.VERTICAL);
        LinearLayout head=new LinearLayout(activity);head.setOrientation(LinearLayout.HORIZONTAL);head.setGravity(Gravity.CENTER_VERTICAL);head.setMinimumHeight(dp(46));head.setClickable(true);head.setFocusable(true);
        TextView title=new TextView(activity);title.setText(label);title.setTextSize(14);head.addView(title,new LinearLayout.LayoutParams(0,-2,1f));
        TextView chev=new TextView(activity);chev.setTextSize(15);chev.setGravity(Gravity.CENTER);chev.setText(open?"–":"+");head.addView(chev,new LinearLayout.LayoutParams(dp(32),-2));
        LinearLayout content=new LinearLayout(activity);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(dp(6),0,dp(2),dp(8));content.setVisibility(open?View.VISIBLE:View.GONE);
        head.setOnClickListener(v->{boolean o=content.getVisibility()!=View.VISIBLE;content.setVisibility(o?View.VISIBLE:View.GONE);chev.setText(o?"–":"+");});
        group.addView(head);group.addView(content);owner.addView(group);
        sectionHeads.add(title);sectionHeads.add(chev);
        return content;
    }
    private Switch switchRow(LinearLayout owner,String label){
        LinearLayout r=new LinearLayout(activity);r.setOrientation(LinearLayout.HORIZONTAL);r.setGravity(Gravity.CENTER_VERTICAL);r.setMinimumHeight(dp(44));
        TextView t=new TextView(activity);t.setText(label);t.setTextSize(14);r.addView(t,new LinearLayout.LayoutParams(0,-2,1f));
        Switch sw=new Switch(activity);sw.setContentDescription(label);sw.setClickable(true);r.addView(sw,new LinearLayout.LayoutParams(-2,-2));
        owner.addView(r);return sw;
    }
    private TextView caption(LinearLayout owner,String s){TextView t=new TextView(activity);t.setText(s);t.setTextSize(11);owner.addView(t);captions.add(t);return t;}
    private void draggable(View handle,View target,boolean clickable){
        handle.setOnTouchListener(new View.OnTouchListener(){float downX,downY,originX,originY;boolean moved;
            public boolean onTouch(View v,MotionEvent e){int a=e.getActionMasked();if(a==MotionEvent.ACTION_DOWN){downX=e.getRawX();downY=e.getRawY();originX=target.getX();originY=target.getY();moved=false;return true;}
                if(a==MotionEvent.ACTION_MOVE){float dx=e.getRawX()-downX,dy=e.getRawY()-downY;if(Math.hypot(dx,dy)>dp(6))moved=true;if(moved){target.setX(Math.max(0,Math.min(parent.getWidth()-target.getWidth(),originX+dx)));target.setY(Math.max(0,Math.min(parent.getHeight()-target.getHeight(),originY+dy)));}return true;}
                if(a==MotionEvent.ACTION_UP){if(!moved&&clickable)v.performClick();return true;}return true;}
        });
    }
    private final class RazorIcon extends View {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        RazorIcon(Context c){super(c);setContentDescription("Open PGRazor settings. Drag to reposition.");setFocusable(true);setClickable(true);}
        protected void onDraw(Canvas c){super.onDraw(c);float scale=Math.min(getWidth(),getHeight())/48f;c.save();c.scale(scale,scale);paint.setColor(surface());c.drawCircle(24,24,23,paint);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1.5f);paint.setColor(accent());c.drawCircle(24,24,22,paint);paint.setStyle(Paint.Style.FILL);
            Path r=new Path();r.moveTo(13,11);r.lineTo(29,11);r.lineTo(36,18);r.lineTo(29,26);r.lineTo(36,37);r.lineTo(26,37);r.lineTo(19,26);r.lineTo(19,37);r.lineTo(12,37);r.lineTo(17,19);r.lineTo(24,19);r.lineTo(23,22);r.lineTo(27,22);r.lineTo(30,18);r.lineTo(27,16);r.lineTo(12,16);r.close();c.drawPath(r,paint);c.restore();}
    }
    /** Shows the destination theme: golden sun in dark mode, indigo moon in light mode. */
    private final class ThemeIcon extends View {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        ThemeIcon(Context c){super(c);setFocusable(true);setClickable(true);setBackground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x3345e1ba),null,rounded(0xffffffff,24)));}
        protected void onDraw(Canvas c){super.onDraw(c);float x=getWidth()/2f,y=getHeight()/2f;
            if(Control.darkTheme()){
                paint.setColor(0xffffcf5c);paint.setStyle(Paint.Style.FILL);c.drawCircle(x,y,dp(5),paint);paint.setStrokeWidth(dp(2));paint.setStrokeCap(Paint.Cap.ROUND);
                for(int i=0;i<8;i++){double a=i*Math.PI/4;c.drawLine(x+(float)Math.cos(a)*dp(8),y+(float)Math.sin(a)*dp(8),x+(float)Math.cos(a)*dp(11),y+(float)Math.sin(a)*dp(11),paint);}
            }else{
                paint.setColor(0xff5355b9);paint.setStyle(Paint.Style.FILL);
                Path moon=new Path();moon.addCircle(x,y,dp(10),Path.Direction.CW);
                Path cut=new Path();cut.addCircle(x+dp(6),y-dp(4),dp(9),Path.Direction.CW);moon.op(cut,Path.Op.DIFFERENCE);c.drawPath(moon,paint);
            }
        }
    }
    /** A clean close affix: a small X drawn inside a 48dp hitbox. */
    private final class CloseIcon extends View {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        CloseIcon(Context c){super(c);setContentDescription("Close PGRazor settings");setFocusable(true);setClickable(true);
            setBackground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x3345e1ba),null,rounded(0xffffffff,24)));}
        protected void onDraw(Canvas c){super.onDraw(c);float cx=getWidth()/2f,cy=getHeight()/2f,r=dp(8);paint.setStyle(Paint.Style.STROKE);paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeWidth(dp(2));paint.setColor(muted());c.drawLine(cx-r,cy-r,cx+r,cy+r,paint);c.drawLine(cx-r,cy+r,cx+r,cy-r,paint);}
    }

    private long lastTick = SystemClock.elapsedRealtime(), lastLog;
    private boolean closed, lastEnabled;
    /** Pads the full-screen settings panel inside the status bar, navigation bar, and IME. */
    private void applyPanelInsets(WindowInsets insets) {
        if(insets==null)return;
        int top,bottom,left,right;
        if(Build.VERSION.SDK_INT>=30){
            android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime());
            android.graphics.Insets safe=insets.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
            top=Math.max(bars.top,safe.top);bottom=Math.max(bars.bottom,safe.bottom);left=Math.max(bars.left,safe.left);right=Math.max(bars.right,safe.right);
        }else{
            top=insets.getSystemWindowInsetTop();bottom=insets.getSystemWindowInsetBottom();
            left=insets.getSystemWindowInsetLeft();right=insets.getSystemWindowInsetRight();
        }
        if(top==0){int id=activity.getResources().getIdentifier("status_bar_height","dimen","android");top=id!=0?activity.getResources().getDimensionPixelSize(id):dp(28);}
        panel.setPadding(dp(12)+left,dp(8)+top,dp(12)+right,dp(12)+bottom);
    }
    private void showItemSettings(){
        LinearLayout form=new LinearLayout(activity);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(dp(16),dp(8),dp(16),dp(8));
        CheckBox enabled=new CheckBox(activity);enabled.setText("Enable automatic item transfer");enabled.setChecked(Control.itemTransferEnabled());form.addView(enabled);
        TextView explanation=new TextView(activity);explanation.setText("Check items to trim and set the maximum to keep. Saving applies to your current bag and future items. A limit of 0 removes all of that item. Unchecked items are kept.");form.addView(explanation);
        java.util.Map<Integer,Integer> limits=new java.util.HashMap<>();java.util.Set<Integer> selected=new java.util.HashSet<>();
        for(String row:Control.itemLimits().split(";"))try{String[] b=row.split(":");limits.put(Integer.parseInt(b[0]),Integer.parseInt(b[1]));}catch(RuntimeException ignored){}
        for(String row:Control.itemRules().split(";"))try{String[] b=row.split(":");int id=Integer.parseInt(b[0]);selected.add(id);limits.put(id,Integer.parseInt(b[1]));}catch(RuntimeException ignored){}
        LinearLayout rows=new LinearLayout(activity);rows.setOrientation(LinearLayout.VERTICAL);ScrollView scroll=new ScrollView(activity);scroll.addView(rows);form.addView(scroll,new LinearLayout.LayoutParams(-1,dp(380)));
        java.util.Map<Integer,CheckBox> boxes=new java.util.LinkedHashMap<>();java.util.Map<Integer,EditText> inputs=new java.util.LinkedHashMap<>();
        Runnable populate=()->{for(String row:Control.itemCatalog().split("\n")){String[] b=row.split("\\|",-1);if(b.length!=3)continue;int id;try{id=Integer.parseInt(b[0]);}catch(NumberFormatException invalid){continue;}if(boxes.containsKey(id)){boxes.get(id).setText(b[1]+" ("+b[2]+" in bag)");continue;}
            LinearLayout line=new LinearLayout(activity);line.setOrientation(LinearLayout.HORIZONTAL);line.setGravity(Gravity.CENTER_VERTICAL);
            CheckBox box=new CheckBox(activity);box.setText(b[1]+" ("+b[2]+" in bag)");box.setChecked(selected.contains(id));line.addView(box,new LinearLayout.LayoutParams(0,-2,1));
            EditText cap=new EditText(dialogContext());cap.setInputType(InputType.TYPE_CLASS_NUMBER);cap.setSingleLine(true);cap.setHint("Max");cap.setText(String.valueOf(limits.containsKey(id)?limits.get(id):100));cap.setContentDescription("Maximum "+b[1]+" to keep");cap.setEnabled(box.isChecked());box.setOnCheckedChangeListener((button,checked)->cap.setEnabled(checked));line.addView(cap,new LinearLayout.LayoutParams(dp(80),-2));rows.addView(line);styleTree(line);boxes.put(id,box);inputs.put(id,cap);
        }};populate.run();
        TextView status=new TextView(activity);status.setText(Control.itemStatus());form.addView(status);
        AlertDialog dialog=new AlertDialog.Builder(dialogContext()).setTitle("Auto-transfer inventory items").setView(form).setNegativeButton("Cancel",null).setPositiveButton("Save & apply",null).create();
        final Runnable[] poll=new Runnable[1];poll[0]=()->{if(!dialog.isShowing())return;populate.run();status.setText(Control.itemStatus());handler.postDelayed(poll[0],1000);};
        dialog.setOnDismissListener(d->handler.removeCallbacks(poll[0]));dialog.show();styleTree(form);handler.post(poll[0]);
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{StringBuilder rules=new StringBuilder(),all=new StringBuilder();for(java.util.Map.Entry<Integer,EditText> e:inputs.entrySet()){int cap;try{cap=Integer.parseInt(e.getValue().getText().toString().trim());if(cap<0||cap>100000)throw new NumberFormatException();}catch(NumberFormatException invalid){e.getValue().setError("Enter 0 to 100000");return;}String rule=e.getKey()+":"+cap+";";all.append(rule);if(boxes.get(e.getKey()).isChecked())rules.append(rule);}
            Control.saveItemRules(enabled.isChecked(),rules.toString(),all.toString());dialog.dismiss();refresh();});
    }
    private int dp(float x) { return Math.round(x * activity.getResources().getDisplayMetrics().density); }
    private TextView text(String label, int size, int color) {
        TextView v = new TextView(activity); v.setText(label); v.setTextSize(size); v.setTextColor(color); return v;
    }
    private Button button(String label) {
        Button v = new Button(activity); v.setText(label); v.setAllCaps(false); v.setTextSize(13); return v;
    }
    public Pad(Activity host) {
        activity = host;
        parent = (FrameLayout)host.getWindow().getDecorView();
        panel = new LinearLayout(host); panel.setOrientation(LinearLayout.VERTICAL); panel.setPadding(dp(12), dp(8), dp(12), dp(12));
        panel.setBackgroundColor(surface()); panel.setElevation(dp(12));
        // Full-screen settings header with theme and close controls.
        LinearLayout header = new LinearLayout(host); header.setOrientation(LinearLayout.HORIZONTAL); header.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = text("PGRazor", 19, accent()); title.setTypeface(Typeface.DEFAULT,Typeface.BOLD); title.setPadding(dp(4), dp(8), 0, dp(8)); sectionHeads.add(title);
        header.addView(title, new LinearLayout.LayoutParams(0, dp(48), 1f));
        themeIcon = new ThemeIcon(host); header.addView(themeIcon,new LinearLayout.LayoutParams(dp(48),dp(48)));
        themeIcon.setOnClickListener(v -> {Control.setDarkTheme(!Control.darkTheme());applyTheme();});
        closeIcon = new CloseIcon(host); header.addView(closeIcon, new LinearLayout.LayoutParams(dp(48), dp(48)));
        panel.addView(header);
        View gap = new View(host); panel.addView(gap, new LinearLayout.LayoutParams(-1, dp(8)));
        body = new LinearLayout(host); body.setOrientation(LinearLayout.VERTICAL);
        bodyScroll = new ScrollView(host); bodyScroll.setFillViewport(false); bodyScroll.setVerticalScrollBarEnabled(false);
        bodyScroll.addView(body, new ScrollView.LayoutParams(-1,-2));
        panel.addView(bodyScroll, new LinearLayout.LayoutParams(-1,0,1));
        TextView discord = text("Join our Discord", 14, accent());
        discord.setGravity(Gravity.CENTER); discord.setMinimumHeight(dp(48));
        discord.setContentDescription("Join the PGRazor Discord community");
        discord.setClickable(true); discord.setFocusable(true); sectionHeads.add(discord);
        panel.addView(discord, new LinearLayout.LayoutParams(-1,dp(48)));
        discord.setOnClickListener(v -> {
            try { activity.startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse("https://discord.gg/9QqfkDSQX3"))); }
            catch (android.content.ActivityNotFoundException unavailable) {
                android.widget.Toast.makeText(activity, "No app available to open Discord links", android.widget.Toast.LENGTH_SHORT).show();
            }
        });


        stick = new Stick(host);
        joystickOverlay = new LinearLayout(host); joystickOverlay.setOrientation(LinearLayout.VERTICAL);
        TextView grip = text("• • •", 12, muted()); grip.setGravity(Gravity.CENTER); joystickOverlay.addView(grip, new LinearLayout.LayoutParams(-1, dp(28)));
        joystickOverlay.addView(stick, new LinearLayout.LayoutParams(dp(136), dp(136))); draggable(grip, joystickOverlay, false);

        // Always-visible status and primary action.
        coords = text("", 16, ink()); coords.setPadding(dp(4), dp(6), dp(4), dp(10)); body.addView(coords);
        // ----- Location & overlays -----
        LinearLayout loc = section(body, "Location & overlays", true);
        steeringStatus = caption(loc, "Joystick follows the camera");
        Button position = button("Coordinates & speed"); loc.addView(position); position.setOnClickListener(v -> edit());
        Button map = button("World map"); loc.addView(map);
        map.setOnClickListener(v -> openWorldMap());
        mapTap = button("Game map tap: Do nothing"); loc.addView(mapTap);
        mapTap.setOnClickListener(v -> { Control.setMapTapMode((Control.mapTapMode()+1)%3); refresh(); });
        spawnSwitch = switchRow(loc, "Spawn booster (80 m)"); spawnSwitch.setChecked(Control.spawnBooster());
        spawnSwitch.setOnCheckedChangeListener((v,checked) -> { if(checked==Control.spawnBooster())return; Control.setSpawnBooster(spawnSwitch.isChecked()); });
        spawnStatus = caption(loc, "");
        cooldownSwitch = switchRow(loc, "Cooldown overlay"); cooldownSwitch.setChecked(Control.cooldownOverlay());
        cooldownSwitch.setOnCheckedChangeListener((v,checked) -> { if(checked==Control.cooldownOverlay())return; Control.setCooldownOverlay(cooldownSwitch.isChecked()); refresh(); });
        Button history = button("Cooldown history"); loc.addView(history); history.setOnClickListener(v -> Cooldown.show(activity));
        joystickSwitch = switchRow(loc, "Show joystick"); joystickSwitch.setChecked(Control.joystickVisible());
        joystickSwitch.setOnCheckedChangeListener((v,checked) -> { if(checked==Control.joystickVisible())return; stick.release(true); Control.setJoystickVisible(joystickSwitch.isChecked()); joystickOverlay.setVisibility(joystickSwitch.isChecked()?View.VISIBLE:View.GONE); });

        // ----- Catch & summary (gated by catch-summary support) -----
        LinearLayout catchC = section(body, "Catch & summary", false); catchRoot = (View)catchC.getParent();
        LinearLayout sumRow = new LinearLayout(host); sumRow.setOrientation(LinearLayout.HORIZONTAL); sumRow.setGravity(Gravity.CENTER_VERTICAL); sumRow.setMinimumHeight(dp(44));
        quickSummaryLabel = new TextView(host); quickSummaryLabel.setTextSize(14); sumRow.addView(quickSummaryLabel, new LinearLayout.LayoutParams(0,-2,1f));
        quickSummarySwitch = new Switch(host); quickSummarySwitch.setContentDescription("Quick catch"); sumRow.addView(quickSummarySwitch, new LinearLayout.LayoutParams(-2,-2)); catchC.addView(sumRow);
        quickSummarySwitch.setChecked(Control.quickSummaryEnabled());
        quickSummarySwitch.setOnCheckedChangeListener((v,checked) -> { if(checked==Control.quickSummaryEnabled())return; Control.setQuickSummaryEnabled(quickSummarySwitch.isChecked()); refresh(); });
        quickSummaryStatus = caption(catchC, "");
        LinearLayout txC = section(catchC, "Transfer on catch", false);
        autoTransferSwitch = switchRow(txC, "Transfer below 90% IV"); autoTransferSwitch.setChecked(Control.autoTransferEnabled());
        autoTransferSwitch.setOnCheckedChangeListener((v,checked) -> { if(checked==Control.autoTransferEnabled())return; Control.setAutoTransferEnabled(autoTransferSwitch.isChecked()); });
        String[] protections={"Keep legendary / mythical / Ultra Beasts","Keep shiny Pokemon","Keep event / costume Pokemon","Keep background Pokemon","Keep XXS","Keep XXL"};
        for(int i=0;i<6;i++){final int bit=1<<i;CheckBox box=new CheckBox(host);box.setText(protections[i]);box.setChecked((Control.transferProtect()&bit)!=0);transferProtection[i]=box;txC.addView(box);
            box.setOnClickListener(v->Control.setTransferProtect(box.isChecked()?Control.transferProtect()|bit:Control.transferProtect()&~bit));}
        caption(txC, "Transfers are permanent. Favorites and unknown data are always kept.");
        transferStatus = caption(txC, "");
        quickSpinSwitch = switchRow(catchC, "Quick spin"); quickSpinSwitch.setChecked(Control.quickSpinEnabled());
        quickSpinSwitch.setOnCheckedChangeListener((v,checked) -> { if(checked==Control.quickSpinEnabled())return; Control.setQuickSpinEnabled(quickSpinSwitch.isChecked()); });
        quickSpinStatus = caption(catchC, "");
        berrySwitch = switchRow(catchC, "Catching berry overlay"); berrySwitch.setChecked(Control.encounterBerryEnabled());
        berrySwitch.setOnCheckedChangeListener((v,checked) -> { if(checked==Control.encounterBerryEnabled())return; Control.setEncounterBerryEnabled(berrySwitch.isChecked()); refresh(); });


        LinearLayout vgpC=section(body,"Virtual Go Plus",false);
        vgpSwitch=switchRow(vgpC,"VGP overlay");vgpSwitch.setChecked(Control.vgpOverlay());
        vgpSwitch.setOnCheckedChangeListener((b,checked)->{if(checked!=Control.vgpOverlay())Control.setVgpOverlay(checked);});
        String[] vgpLabels={"Nearby Pok\u00e9mon","Nearby Pok\u00e9Stops","Push notifications"};
        for(int i=0;i<3;i++){final int bit=1<<i;CheckBox box=new CheckBox(host);box.setText(vgpLabels[i]);box.setChecked((Control.vgpOptions()&bit)!=0);vgpChoices[i]=box;vgpC.addView(box);
            box.setOnClickListener(v->{Control.setVgpOptions(box.isChecked()?Control.vgpOptions()|bit:Control.vgpOptions()&~bit);
                if(bit==4&&box.isChecked()&&Build.VERSION.SDK_INT>=33&&activity.checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=android.content.pm.PackageManager.PERMISSION_GRANTED)activity.requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},7301);
            });
        }
        vgpCooldownStop=new CheckBox(host);vgpCooldownStop.setText("Stop on cooldown (estimated)");vgpCooldownStop.setContentDescription("Stop Virtual Go Plus during the estimated action cooldown");vgpCooldownStop.setChecked(Control.vgpStopOnCooldown());vgpC.addView(vgpCooldownStop);
        vgpCooldownStop.setOnClickListener(v->{if(vgpCooldownStop.isChecked()!=Control.vgpStopOnCooldown())Control.setVgpStopOnCooldown(vgpCooldownStop.isChecked());refresh();});
        vgpStatus=caption(vgpC,Control.vgpStatus());

        // ----- Auto catch & spin engine -----
        LinearLayout autoC=section(body,"Auto catch & spin",true);
        autoEngineButton=button("Engine: PGRazor VGP");autoC.addView(autoEngineButton);
        autoEngineButton.setOnClickListener(v->{Control.setAutoEngine(Control.autoEngine()==1?0:1);refresh();});
        nativeCatchSwitch=switchRow(autoC,"Rasiel native auto catch");
        nativeCatchSwitch.setChecked(Control.nativeCatch());
        nativeCatchSwitch.setOnCheckedChangeListener((v,checked)->{if(checked!=Control.nativeCatch())Control.setNativeCatch(checked);refresh();});
        nativeSpinSwitch=switchRow(autoC,"Rasiel native auto spin");
        nativeSpinSwitch.setChecked(Control.nativeSpin());
        nativeSpinSwitch.setOnCheckedChangeListener((v,checked)->{if(checked!=Control.nativeSpin())Control.setNativeSpin(checked);refresh();});
        LinearLayout ballRow=new LinearLayout(host);ballRow.setOrientation(LinearLayout.HORIZONTAL);ballRow.setGravity(Gravity.CENTER_VERTICAL);
        TextView ballLabel=new TextView(host);ballLabel.setText("Balls");ballLabel.setTextSize(14);ballRow.addView(ballLabel,new LinearLayout.LayoutParams(0,-2,1f));
        String[] ballNames={"Poke","Great","Ultra"};
        for(int i=0;i<3;i++){final int bit=1<<i;CheckBox box=new CheckBox(host);box.setText(ballNames[i]);box.setChecked((Control.nativeBalls()&bit)!=0);nativeBallChoices[i]=box;ballRow.addView(box);
            box.setOnClickListener(v->{int mask=Control.nativeBalls();mask=box.isChecked()?mask|bit:mask&~bit;if(mask==0){box.setChecked(true);return;}Control.setNativeBalls(mask);});}
        autoC.addView(ballRow);
        nativeGradeButton=button("Native throw: Excellent");autoC.addView(nativeGradeButton);
        nativeGradeButton.setOnClickListener(v->{Control.setNativeGrade((Control.nativeGrade()+1)%4);refresh();});
        nativeBerryButton=button("Native berry: Off");autoC.addView(nativeBerryButton);
        nativeBerryButton.setOnClickListener(v->{int index=0;for(int i=0;i<BERRY_IDS.length;i++)if(BERRY_IDS[i]==Control.nativeBerry())index=i;Control.setNativeBerry(BERRY_IDS[(index+1)%BERRY_IDS.length]);refresh();});
        nativeCurveSwitch=switchRow(autoC,"Curveball throws");
        nativeCurveSwitch.setChecked(Control.nativeCurve());
        nativeCurveSwitch.setOnCheckedChangeListener((v,checked)->{if(checked!=Control.nativeCurve())Control.setNativeCurve(checked);});
        nativeScreenFreeSwitch=switchRow(autoC,"Screen-free catches (direct throw)");
        nativeScreenFreeSwitch.setChecked(Control.nativeScreenFree());
        nativeScreenFreeSwitch.setOnCheckedChangeListener((v,checked)->{if(checked!=Control.nativeScreenFree())Control.setNativeScreenFree(checked);});
        caption(autoC,"The selected engine owns Auto Catch and Auto Spin. Switching engines stops the other one. Balls, berries, and throw settings apply to the Rasiel native engine; berries are used by screen catches. Native automation requires the --quick-close build.");
        nativeStatus=caption(autoC,Control.nativeStatus());

        // ----- Auto gym feed -----
        LinearLayout gymC=section(body,"Auto gym feed",false);
        gymFeedSwitch=switchRow(gymC,"Feed gym defenders");
        gymFeedSwitch.setChecked(Control.gymFeedEnabled());
        gymFeedSwitch.setOnCheckedChangeListener((v,checked)->{if(checked!=Control.gymFeedEnabled())Control.setGymFeedEnabled(checked);refresh();});
        gymBerryButton=button("Gym berry: Auto (any owned)");gymC.addView(gymBerryButton);
        gymBerryButton.setOnClickListener(v->{int index=0;for(int i=0;i<BERRY_IDS.length;i++)if(BERRY_IDS[i]==Control.gymFeedBerry())index=i;Control.setGymFeedBerry(BERRY_IDS[(index+1)%BERRY_IDS.length]);refresh();});
        caption(gymC,"Feeds one owned berry per defender, up to 10 per gym every 30 minutes.");
        gymFeedStatus=caption(gymC,Control.gymFeedStatus());

        // ----- Field research -----
        LinearLayout researchC=section(body,"Field research",false);
        researchSwitch=switchRow(researchC,"Auto claim completed field research");
        researchSwitch.setChecked(Control.claimResearch());
        researchSwitch.setOnCheckedChangeListener((v,checked)->{if(checked!=Control.claimResearch())Control.setClaimResearch(checked);refresh();});
        researchRulesButton=button("Research filter: 0 rules");researchC.addView(researchRulesButton);
        researchRulesButton.setOnClickListener(v->showResearchRules());
        caption(researchC,"Matching research is removed instead of claimed. Filter lines use task|reward; use * for any task or reward and :? for any quantity (for example Catch 5 Pokemon|p:25). Empty filter keeps every task.");
        researchStatus=caption(researchC,Control.researchStatus());

        // ----- Auto feed buddy -----
        LinearLayout eggsC = section(body, "Auto incubate eggs", false);
        incubatorSwitch = switchRow(eggsC, "Auto incubate");
        incubatorSwitch.setChecked(Control.autoIncubate());
        incubatorSwitch.setOnCheckedChangeListener((v, checked) -> {
            if (checked != Control.autoIncubate()) Control.setAutoIncubate(checked);
        });
        incubatorPriority = button("Priority: shortest distance"); eggsC.addView(incubatorPriority);
        incubatorPriority.setOnClickListener(v -> { Control.setIncubateLongest(!Control.incubateLongest()); refresh(); });
        caption(eggsC, "Unlimited incubator only");
        incubatorStatus = caption(eggsC, Control.incubatorStatus());

        LinearLayout buddyC = section(body, "Auto feed buddy", false); buddyRoot = (View)buddyC.getParent();
        buddyStatus = caption(buddyC, Control.buddyStatus());
        RadioGroup buddyBerries = new RadioGroup(host); buddyBerries.setOrientation(LinearLayout.VERTICAL);
        for(int i=0;i<BERRY_IDS.length;i++){final int id=BERRY_IDS[i];RadioButton b=new RadioButton(host);b.setId(View.generateViewId());b.setText(BERRY_NAMES[i]);b.setChecked(Control.buddyBerry()==id);b.setOnClickListener(v->Control.setBuddyBerry(id));buddyChoices[i]=b;buddyBerries.addView(b);}
        buddyC.addView(buddyBerries);


        // ----- Friend gifts -----
        LinearLayout giftC = section(body, "Friend gifts", false); giftRoot = (View)giftC.getParent();
        String[] giftLabels={"Auto open gifts","Auto send gifts","Add an owned sticker"};
        for(int i=0;i<3;i++){final int bit=1<<i;CheckBox box=new CheckBox(host);box.setText(giftLabels[i]);box.setChecked((Control.giftOptions()&bit)!=0);giftChoices[i]=box;giftC.addView(box);box.setOnClickListener(v->Control.setGiftOptions(box.isChecked()?Control.giftOptions()|bit:Control.giftOptions()&~bit));}

        giftStatus = caption(giftC, "");

        // ----- Inventory (opens its modal directly) -----
        LinearLayout itemsC = new LinearLayout(host); itemsC.setOrientation(LinearLayout.VERTICAL); body.addView(itemsC); itemsRoot = itemsC;
        itemSettings = button("Auto-transfer items"); itemsC.addView(itemSettings); itemSettings.setOnClickListener(v -> showItemSettings());
        itemStatus = caption(itemsC, "");

        // ----- Team Rocket -----
        LinearLayout rocketC = section(body, "Team Rocket", false); rocketRoot = (View)rocketC.getParent();
        String[] rocketLabels={"Auto quick attack","Auto charged attack","Auto shield"};
        for(int i=0;i<3;i++){final int bit=1<<i;CheckBox box=new CheckBox(host);box.setText(rocketLabels[i]);box.setChecked((Control.rocketOptions()&bit)!=0);rocketChoices[i]=box;rocketC.addView(box);
            box.setOnClickListener(v->Control.setRocketOptions(box.isChecked()?Control.rocketOptions()|bit:Control.rocketOptions()&~bit));}

        rocketStatus = caption(rocketC, "");

        // ----- Raids, gyms & Dynamax -----
        LinearLayout battleC = section(body, "Raids, gyms & Dynamax", false); battleRoot = (View)battleC.getParent();
        String[] battleLabels={"Raids: auto quick attack","Raids: auto charged attack","Gyms: auto quick attack","Gyms: auto charged attack","Dynamax: auto quick attack","Dynamax: auto charged attack","Dynamax: auto Max attack","Raids: auto dodge","Gyms: auto dodge","Dynamax: auto dodge"};
        for(int i=0;i<10;i++){final int bit=1<<i;CheckBox box=new CheckBox(host);box.setText(battleLabels[i]);box.setChecked((Control.battleOptions()&bit)!=0);battleChoices[i]=box;battleC.addView(box);box.setOnClickListener(v->Control.setBattleOptions(box.isChecked()?Control.battleOptions()|bit:Control.battleOptions()&~bit));}

        battleStatus = caption(battleC, "");

        // ----- Throws & catch animation (gated by ball-animation support) -----
        LinearLayout throwC = section(body, "Throws", false); quickBallRoot = (View)throwC.getParent();

        throwGrade = button("Throw rating: OFF"); throwC.addView(throwGrade);
        throwGrade.setOnClickListener(v -> { Control.setThrowGrade((Control.throwGrade()+1)%4); refresh(); });
        curveSwitch = switchRow(throwC, "Always curveball"); curveSwitch.setChecked(Control.throwCurve());
        curveSwitch.setOnCheckedChangeListener((v,checked) -> { if(checked==Control.throwCurve())return; Control.setThrowCurve(curveSwitch.isChecked()); refresh(); });
        arSwitch = switchRow(throwC, "AR+ throw bonus"); arSwitch.setChecked(Control.throwAr());
        arSwitch.setOnCheckedChangeListener((v,checked) -> { if(checked==Control.throwAr())return; Control.setThrowAr(arSwitch.isChecked()); refresh(); });
        caption(throwC, "Wild encounters. Combines with throw rating and curveball; server bonus unverified.");
        quickBallStatus = caption(throwC, "");

        Button settingsBackup=button("Export / import settings");body.addView(settingsBackup);
        settingsBackup.setOnClickListener(v->activity.startActivity(new Intent(activity,LogActivity.class).putExtra("settingsBackup",true)));

        // ----- Diagnostics (status plumbing kept out of everyday settings) -----
        LinearLayout diag = section(body, "Diagnostics", false);
        state = caption(diag, Control.connection);
        for(TextView status:new TextView[]{steeringStatus,spawnStatus,quickSummaryStatus,transferStatus,quickSpinStatus,buddyStatus,giftStatus,itemStatus,rocketStatus,battleStatus,quickBallStatus}){
            ((ViewGroup)status.getParent()).removeView(status);diag.addView(status);
        }
        cameraRoot = new LinearLayout(host); cameraRoot.setOrientation(LinearLayout.VERTICAL); diag.addView(cameraRoot);
        cameraStatus = caption(cameraRoot, ""); cameraStatus.setMaxLines(3); cameraStatus.setEllipsize(android.text.TextUtils.TruncateAt.END);
        cameraSample = button("Sample camera (10s)"); cameraRoot.addView(cameraSample);
        cameraSample.setOnClickListener(v -> { if (Control.requestCameraSample()) { stick.release(); refresh(); } });
        interactionRoot = new LinearLayout(host); interactionRoot.setOrientation(LinearLayout.VERTICAL); diag.addView(interactionRoot);
        interactionStatus = caption(interactionRoot, ""); interactionStatus.setMaxLines(3); interactionStatus.setEllipsize(android.text.TextUtils.TruncateAt.END);
        interactionCapture = button("Capture catch/spin (60s)"); interactionRoot.addView(interactionCapture);
        interactionCapture.setOnClickListener(v -> {
            if (Control.interactionDiagnosticRunning()) Control.requestInteractionStop();
            else if (Control.requestInteractionTrace()) stick.release();
            refresh();
        });
        Button logs = button("Run log / export"); diag.addView(logs);
        logs.setOnClickListener(v -> activity.startActivity(new Intent(activity, LogActivity.class)));

        // Closing the full-screen settings panel simply returns to the game (or the quick menu on the next tap).
        closeIcon.setOnClickListener(v -> panel.setVisibility(View.GONE));
        // The settings panel is a full-screen modal now; it consumes taps so the game behind it stays inert.
        panel.setClickable(true);
        parent.addView(panel, new FrameLayout.LayoutParams(-1, -1));

        FrameLayout.LayoutParams joyLayout=new FrameLayout.LayoutParams(dp(136),-2,Gravity.LEFT|Gravity.BOTTOM);joyLayout.leftMargin=dp(16);joyLayout.bottomMargin=dp(96);parent.addView(joystickOverlay,joyLayout);

        // Compact catching-berry overlay; the popup chooses owned berries and Off.
        encounterBerry=button("Berry: Off");encounterBerry.setTextSize(12);encounterBerry.setAllCaps(false);encounterBerry.setGravity(Gravity.CENTER);encounterBerry.setPadding(dp(10),dp(6),dp(10),dp(6));
        FrameLayout.LayoutParams berryLayout=new FrameLayout.LayoutParams(dp(126),dp(58),Gravity.RIGHT|Gravity.CENTER_VERTICAL);berryLayout.rightMargin=dp(10);parent.addView(encounterBerry,berryLayout);encounterBerry.setVisibility(View.GONE);
        encounterBerry.setOnClickListener(v->{PopupMenu choices=new PopupMenu(activity,encounterBerry);for(int i=0;i<BERRY_IDS.length;i++){int id=BERRY_IDS[i],count=Control.berryCount(id);MenuItem item=choices.getMenu().add(0,id,i,BERRY_NAMES[i]+(id==0?"":" ("+count+")"));item.setCheckable(true);item.setChecked(Control.autoBerrySelected()==id);item.setEnabled(id==0||(count>0&&Control.berriesAllowed()));}choices.setOnMenuItemClickListener(item->{Control.setAutoBerry(item.getItemId());refresh();return true;});choices.show();});

        cooldownTimer=button("History  --:--");cooldownTimer.setTextSize(14);cooldownTimer.setAllCaps(false);cooldownTimer.setTextColor(accent());FrameLayout.LayoutParams timerLayout=new FrameLayout.LayoutParams(dp(165),dp(44),Gravity.TOP|Gravity.RIGHT);timerLayout.topMargin=dp(44);timerLayout.rightMargin=dp(12);parent.addView(cooldownTimer,timerLayout);cooldownTimer.setOnClickListener(v->Cooldown.show(activity));cooldownDrag=OverlayDrag.attach(parent,cooldownTimer,"cooldown");

        panel.setOnApplyWindowInsetsListener((view,insets) -> {applyPanelInsets(insets);return insets;});
        panel.requestApplyInsets();

        vgpToggle=new VgpToggle(host);FrameLayout.LayoutParams vgpButtonLayout=new FrameLayout.LayoutParams(dp(54),dp(54),Gravity.TOP|Gravity.LEFT);vgpButtonLayout.leftMargin=dp(12);vgpButtonLayout.topMargin=dp(156);parent.addView(vgpToggle,vgpButtonLayout);vgpToggle.setOnClickListener(v->{Control.setVgpEnabled(!Control.vgpEnabled());refresh();});
        vgpActivity=text("VGP",12,ink());vgpActivity.setPadding(dp(10),dp(6),dp(10),dp(6));vgpActivity.setMaxLines(2);vgpActivity.setEllipsize(android.text.TextUtils.TruncateAt.END);
        FrameLayout.LayoutParams vgpLayout=new FrameLayout.LayoutParams(dp(220),-2,Gravity.TOP|Gravity.LEFT);vgpLayout.leftMargin=dp(12);vgpLayout.topMargin=dp(216);parent.addView(vgpActivity,vgpLayout);vgpActivity.setVisibility(View.GONE);
        // The toggle is the drag handle; the status pill follows it as one coherent unit. Tap still flips VGP.
        vgpDrag=OverlayDrag.attach(parent,vgpToggle,vgpActivity,"vgp");
        vgpMarker=new VgpMarker(host);parent.addView(vgpMarker,new FrameLayout.LayoutParams(dp(38),dp(46)));vgpMarker.setVisibility(View.GONE);
        launcher=new RazorIcon(host);FrameLayout.LayoutParams iconLayout=new FrameLayout.LayoutParams(dp(48),dp(48),Gravity.TOP|Gravity.LEFT);iconLayout.leftMargin=dp(12);iconLayout.topMargin=dp(100);parent.addView(launcher,iconLayout);
        launcher.setContentDescription("Open PGRazor quick menu. Drag to reposition.");
        // The R launcher now toggles the compact quick menu; Settings there opens this panel full screen.
        quickMenu=new QuickMenu(host,parent,launcher,new QuickMenu.Listener(){
            public void onMap(){openWorldMap();}
            public double onCycleWalkSpeed(){double s=Control.cycleWalkSpeed();refresh();return s;}
            public void onAutoWalk(){stick.release(true);AutoWalkDialog.show(activity);}
            public void onFeeds(){stick.release(true);LiveFeedDialog.show(activity);}
            public void onFavorites(){QuickLocationDialogs.showFavorites(activity,Pad.this::quickTeleport);}
            public void onTeleport(){QuickLocationDialogs.showTeleport(activity,Pad.this::quickTeleport);}
            public void onSettings(){openSettings();}
            public void onAutoCatch(){Control.toggleAutoCatch();refresh();}
            public void onAutoSpin(){Control.toggleAutoSpin();refresh();}
        });
        launcher.setOnClickListener(v->{if(quickMenu!=null)quickMenu.toggle();});draggable(launcher,launcher,true);

        panel.setVisibility(View.GONE);joystickOverlay.setVisibility(Control.joystickVisible()?View.VISIBLE:View.GONE);applyTheme();
        refresh(); handler.post(tick);
    }
    /** Decode a bundled map-icon once; returns null (never throws, never hits the network) if unavailable. */
    private Bitmap decodeMapIcon(String name){
        try(java.io.InputStream in=activity.getAssets().open("pgrazor/map-icons/"+name)){return BitmapFactory.decodeStream(in);}
        catch(java.io.IOException|RuntimeException ignored){return null;}
    }
    private final class VgpToggle extends View {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint art=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
        private final RectF dst=new RectF();
        // Exact supplied PokeMiners Plus icons, decoded once with alpha intact; a null falls back to the vector glyph.
        private final Bitmap connected=decodeMapIcon("vgp-connected.png"),disconnected=decodeMapIcon("vgp-disconnected.png");
        VgpToggle(Context context){super(context);setFocusable(true);setClickable(true);}
        protected void onDraw(Canvas canvas){super.onDraw(canvas);boolean on=Control.vgpEnabled();canvas.save();canvas.scale(getWidth()/54f,getHeight()/54f);
            paint.setStyle(Paint.Style.FILL);paint.setColor(surface());canvas.drawRoundRect(1,1,53,53,14,14,paint);
            Bitmap icon=on?connected:disconnected;
            if(icon!=null&&icon.getWidth()>0&&icon.getHeight()>0){float box=32f,ratio=Math.min(box/icon.getWidth(),box/icon.getHeight()),w=icon.getWidth()*ratio,h=icon.getHeight()*ratio;dst.set(27-w/2f,21-h/2f,27+w/2f,21+h/2f);canvas.drawBitmap(icon,null,dst,art);}
            else{paint.setColor(on?Color.rgb(33,188,125):Color.rgb(126,134,148));canvas.drawCircle(27,20,13,paint);paint.setColor(Color.WHITE);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(2.5f);canvas.drawArc(19,12,35,28,-55,290,false,paint);canvas.drawLine(27,8,27,20,paint);}
            paint.setStyle(Paint.Style.FILL);paint.setColor(on?Color.rgb(33,188,125):muted());paint.setTextSize(11);paint.setTypeface(Typeface.DEFAULT_BOLD);paint.setTextAlign(Paint.Align.CENTER);canvas.drawText(on?"ON":"OFF",27,50,paint);
            canvas.restore();}
    }
    private final class VgpMarker extends View {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        VgpMarker(Context context){super(context);setClickable(false);setFocusable(false);setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);}
        protected void onDraw(Canvas canvas){super.onDraw(canvas);canvas.save();canvas.scale(getWidth()/38f,getHeight()/46f);
            paint.setStyle(Paint.Style.FILL);paint.setColor(Color.WHITE);canvas.drawCircle(19,18,17,paint);
            paint.setColor(Control.vgpTargetSpin()?Color.rgb(42,170,240):Color.rgb(235,68,85));canvas.drawCircle(19,18,14,paint);
            paint.setColor(Color.WHITE);
            if(Control.vgpTargetSpin()){paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(3);canvas.drawCircle(19,18,8,paint);canvas.drawLine(19,5,19,10,paint);canvas.drawLine(19,26,19,31,paint);canvas.drawLine(6,18,11,18,paint);canvas.drawLine(27,18,32,18,paint);}
            else{paint.setStrokeWidth(3);canvas.drawLine(5,18,33,18,paint);canvas.drawCircle(19,18,5,paint);paint.setColor(Color.rgb(50,55,65));canvas.drawCircle(19,18,2.5f,paint);}
            paint.setStyle(Paint.Style.FILL);paint.setColor(Color.WHITE);Path arrow=new Path();arrow.moveTo(13,36);arrow.lineTo(25,36);arrow.lineTo(19,44);arrow.close();canvas.drawPath(arrow,paint);canvas.restore();
        }
    }

    private String berryName(int id){for(int i=0;i<BERRY_IDS.length;i++)if(BERRY_IDS[i]==id)return BERRY_NAMES[i];return "Off";}
    private int researchRuleCount(){String r=Control.researchRules();if(r.isEmpty())return 0;int n=0;for(String line:r.split("\\n"))if(!line.trim().isEmpty())n++;return n;}
    private void showResearchRules(){
        LinearLayout form=new LinearLayout(activity);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(dp(18),dp(4),dp(18),0);
        EditText rules=new EditText(dialogContext());
        rules.setText(Control.researchRules());
        rules.setHint("Catch 5 Pok\u00e9mon|p:25\n*|i:1:?");
        rules.setMinLines(6);rules.setGravity(Gravity.TOP|Gravity.START);
        rules.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        form.addView(rules,new LinearLayout.LayoutParams(-1,dp(220)));
        TextView help=new TextView(dialogContext());help.setTextSize(12);help.setText("One rule per line: normalized task text|reward token.\nMatching research is removed, not claimed.\nExamples: Catch 5 Pok\u00e9mon|p:25   *|i:1:?   Spin 3 Pok\u00e9Stops|s:?");
        form.addView(help);
        AlertDialog dialog=new AlertDialog.Builder(dialogContext()).setTitle("Field research filter").setView(form)
            .setNegativeButton("Cancel",null).setPositiveButton("Save",null).create();
        dialog.setOnShowListener(ignored->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            try{Control.setResearchOptions(Control.claimResearch(),rules.getText().toString());dialog.dismiss();refresh();}
            catch(IllegalArgumentException error){rules.setError(error.getMessage());}
        }));
        dialog.show();
    }
    private void refresh() {
        if(vgpToggle!=null){vgpToggle.setVisibility(Control.vgpOverlayVisible()&&panel.getVisibility()!=View.VISIBLE&&!(quickMenu!=null&&quickMenu.isShowing())?View.VISIBLE:View.GONE);vgpToggle.setContentDescription("Virtual Go Plus "+(Control.vgpEnabled()?"on; tap to turn off":"off; tap to turn on")+". "+Control.vgpStatus());vgpToggle.invalidate();}

        // Pair the status line with the toggle so the cooldown shutoff reason is visible even when VGP is off.
        if(vgpActivity!=null){vgpActivity.setVisibility(Control.vgpOverlayVisible()&&panel.getVisibility()!=View.VISIBLE&&!(quickMenu!=null&&quickMenu.isShowing())?View.VISIBLE:View.GONE);vgpActivity.setText("VGP  |  "+Control.vgpStatus());vgpActivity.setTextColor(ink());vgpActivity.setBackground(rounded(surface(),10));}
        if(vgpMarker!=null){boolean show=Control.vgpTargetVisible()&&panel.getVisibility()!=View.VISIBLE;vgpMarker.setVisibility(show?View.VISIBLE:View.GONE);if(show){vgpMarker.setX(Control.vgpTargetX()*parent.getWidth()-dp(19));vgpMarker.setY(Control.vgpTargetY()*parent.getHeight()-dp(82));vgpMarker.invalidate();}}

        if(cooldownTimer!=null){cooldownTimer.setVisibility(Control.cooldownOverlay()?View.VISIBLE:View.GONE);cooldownTimer.setText("☰  "+Cooldown.label());cooldownTimer.setTextColor(Cooldown.remaining()>0?Color.rgb(255,186,95):accent());}
        if (lastEnabled != Control.engine.enabled) { lastEnabled = Control.engine.enabled; stick.invalidate(); }
        coords.setText(String.format(Locale.US, "%.6f, %.6f\n%.1f km/h", Control.engine.latitude, Control.engine.longitude, Control.engine.speedKmh));
        if(encounterBerry!=null){boolean visible=Control.encounterBerryVisible();encounterBerry.setVisibility(visible?View.VISIBLE:View.GONE);int sel=Control.autoBerrySelected();int choice=0;for(int i=0;i<BERRY_IDS.length;i++)if(BERRY_IDS[i]==sel)choice=i;int count=Control.berryCount(sel);encounterBerry.setText(Control.encounterBerryBusy()?"Applying berry…":BERRY_NAMES[choice]+(choice==0?"\nTap to choose":" ("+count+")\nOn hit"));encounterBerry.setEnabled(!Control.encounterBerryBusy());}
        boolean preview = Control.preview();
        MotionEngine.RouteProgress route=Control.engine.routeProgress();
        String movement=Control.engine.enabled ? (Control.engine.walking ? "WALKING" : "ON") : "WAITING FOR ADAPTER";
        if (route.total>1 && route.active) movement=String.format(Locale.US,"ROUTE %d/%d  ·  %.0f m left",route.visited+1,route.total,route.remainingMeters);
        else if (route.total>1 && route.visited==route.total) movement="ON  ·  route complete";
        state.setText(Control.connection + "\n" + movement + "  ·  coordinate reads " + Control.latitudeReads + "/" + Control.longitudeReads);
        steeringStatus.setText(Control.cameraSteeringConfigured() ? Control.cameraSteeringStatus() : "Joystick follows the camera");
        if(quickMenu!=null)quickMenu.onRefresh();
        cameraRoot.setVisibility(Control.cameraDiagnosticsConfigured() ? View.VISIBLE : View.GONE);
        cameraStatus.setText(Control.cameraDiagnosticStatus());
        cameraSample.setText(Control.cameraDiagnosticRunning() ? "Sampling camera..." : "Sample camera (10s)");
        cameraSample.setEnabled(Control.cameraDiagnosticsReady() && !Control.cameraSamplePending());
        interactionRoot.setVisibility(Control.interactionDiagnosticsConfigured() ? View.VISIBLE : View.GONE);
        interactionStatus.setText(Control.interactionDiagnosticStatus());
        interactionCapture.setText(Control.interactionDiagnosticRunning() ? "Stop capture" : "Capture catch/spin (60s)");
        interactionCapture.setEnabled(Control.interactionDiagnosticRunning() || (Control.interactionDiagnosticsReady() && !Control.interactionTracePending()));
        int summaryGate = Control.quickSummaryConfigured() ? View.VISIBLE : View.GONE;
        catchRoot.setVisibility(summaryGate); buddyRoot.setVisibility(summaryGate); giftRoot.setVisibility(summaryGate);
        itemsRoot.setVisibility(summaryGate); rocketRoot.setVisibility(summaryGate); battleRoot.setVisibility(summaryGate);
        quickSummaryStatus.setText(Control.quickSummaryStatus());
        autoTransferSwitch.setChecked(Control.autoTransferEnabled());
        for(int i=0;i<6;i++)transferProtection[i].setChecked((Control.transferProtect()&(1<<i))!=0);
        transferStatus.setText(Control.transferStatus());
        vgpSwitch.setChecked(Control.vgpOverlay());vgpStatus.setText(Control.vgpStatus());
        incubatorSwitch.setChecked(Control.autoIncubate());
        incubatorSwitch.setEnabled(Control.incubatorAvailable());
        incubatorPriority.setText("Priority: " + (Control.incubateLongest() ? "longest" : "shortest") + " distance");
        incubatorStatus.setText(Control.autoIncubate() ? Control.incubatorStatus() : "Off");
        for(int i=0;i<3;i++)vgpChoices[i].setChecked((Control.vgpOptions()&(1<<i))!=0);
        vgpCooldownStop.setChecked(Control.vgpStopOnCooldown());
        autoEngineButton.setText("Engine: "+Control.autoEngineName());
        nativeCatchSwitch.setChecked(Control.nativeCatch());
        nativeSpinSwitch.setChecked(Control.nativeSpin());
        for(int i=0;i<3;i++)nativeBallChoices[i].setChecked((Control.nativeBalls()&(1<<i))!=0);
        nativeGradeButton.setText("Native throw: "+new String[]{"OFF","Nice","Great","Excellent"}[Control.nativeGrade()]);
        nativeBerryButton.setText("Native berry: "+berryName(Control.nativeBerry()));
        nativeCurveSwitch.setChecked(Control.nativeCurve());
        nativeScreenFreeSwitch.setChecked(Control.nativeScreenFree());
        nativeStatus.setText(Control.nativeStatus());
        gymFeedSwitch.setChecked(Control.gymFeedEnabled());
        gymBerryButton.setText("Gym berry: "+(Control.gymFeedBerry()==0?"Auto (any owned)":berryName(Control.gymFeedBerry())));
        gymFeedStatus.setText(Control.gymFeedStatus());
        researchSwitch.setChecked(Control.claimResearch());
        int ruleCount=researchRuleCount();
        researchRulesButton.setText("Research filter: "+ruleCount+" rule"+(ruleCount==1?"":"s"));
        researchStatus.setText(Control.researchStatus());
        buddyStatus.setText(Control.buddyStatus());
        for(int i=0;i<BERRY_IDS.length;i++){int id=BERRY_IDS[i],count=Control.berryCount(id);RadioButton b=buddyChoices[i];b.setText(BERRY_NAMES[i]+(id==0?"":" ("+count+")"));b.setChecked(Control.buddyBerry()==id);boolean ready=id==0||(count>0&&Control.buddyAvailable());b.setEnabled(ready);b.setAlpha(ready?1f:0.4f);}
        for(int i=0;i<3;i++)giftChoices[i].setChecked((Control.giftOptions()&(1<<i))!=0);giftStatus.setText(Control.giftStatus());
        for(int i=0;i<10;i++)battleChoices[i].setChecked((Control.battleOptions()&(1<<i))!=0);battleStatus.setText(Control.battleStatus());
        for(int i=0;i<3;i++)rocketChoices[i].setChecked((Control.rocketOptions()&(1<<i))!=0);rocketStatus.setText(Control.rocketStatus());
        itemSettings.setText("Auto-transfer items: "+(Control.itemTransferEnabled()?"ON":"OFF"));itemStatus.setText(Control.itemStatus());
        quickSpinSwitch.setChecked(Control.quickSpinEnabled());quickSpinStatus.setText(Control.quickSpinStatus());
        quickSummaryLabel.setText(Control.quickSummaryAutoDismiss() ? "Quick catch" : "Faster catch summary");
        quickSummarySwitch.setChecked(Control.quickSummaryEnabled());
        quickSummarySwitch.setEnabled(Control.quickSummaryConfigured());
        quickBallRoot.setVisibility(Control.quickBallConfigured() ? View.VISIBLE : View.GONE);
        quickBallStatus.setText(Control.quickBallStatus());
        mapTap.setText("Game map tap: "+new String[]{"Do nothing","Walk","Teleport"}[Control.mapTapMode()]);
        mapTap.setEnabled(Control.quickBallConfigured());
        spawnSwitch.setChecked(Control.spawnBooster());spawnSwitch.setEnabled(Control.spawnAllowed());spawnStatus.setText(Control.spawnStatus());
        throwGrade.setText("Throw rating: "+new String[]{"OFF","Nice","Great","Excellent"}[Control.throwGrade()]);
        throwGrade.setEnabled(Control.quickBallConfigured());
        curveSwitch.setChecked(Control.throwCurve());curveSwitch.setEnabled(Control.quickBallConfigured());
        arSwitch.setChecked(Control.throwAr());arSwitch.setEnabled(Control.throwArReady());
    }
    private final Runnable tick = new Runnable() {
        public void run() {
            if (closed) return;
            Control.checkLease();
            long now = SystemClock.elapsedRealtime();
            stick.applyMotion(now);
            boolean wasWalking = Control.engine.walking;
            MotionEngine.RouteProgress before=Control.engine.routeProgress();
            Control.engine.step((now-lastTick)/1000.0); lastTick = now;
            MotionEngine.RouteProgress after=Control.engine.routeProgress();
            if (before.total>1 && after.total==before.total && after.visited>before.visited)
                Control.event("route-progress", "visited=" + after.visited + "/" + after.total);
            if (wasWalking && !Control.engine.walking && Control.engine.enabled) {
                Control.event(before.total>1 ? "route-completed" : "walk-arrived", String.format(Locale.US,"lat=%.7f lon=%.7f; holding destination",Control.engine.latitude,Control.engine.longitude));
                Control.saveState();
            }
            Control.checkpoint(now);
            refresh();
            if (now-lastLog >= 1000 && Control.engine.enabled) {
                lastLog = now;
                Control.event("position", String.format(Locale.US, "lat=%.7f lon=%.7f speed=%.3f walking=%s reads=%d/%d", Control.engine.latitude, Control.engine.longitude, Control.engine.metersPerSecond(), Control.engine.walking, Control.latitudeReads, Control.longitudeReads));
            }
            handler.postDelayed(this, 100);
        }
    };
    private EditText input(String value, String hint) {
        EditText e = new EditText(dialogContext()); e.setSingleLine(true); e.setHint(hint); e.setText(value);
        e.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL|InputType.TYPE_NUMBER_FLAG_SIGNED); return e;
    }
    private void edit() {
        if (Control.engine.walking) Control.event("walk-cancelled", "Coordinates editor opened");
        stick.release(); refresh();
        LinearLayout form = new LinearLayout(activity); form.setOrientation(LinearLayout.VERTICAL); form.setPadding(dp(24),dp(8),dp(24),dp(8));
        EditText lat = input(Double.toString(Control.engine.latitude), "Latitude (-90 to 90)");
        EditText lon = input(Double.toString(Control.engine.longitude), "Longitude (-180 to 180)");
        EditText speed = input(Double.toString(Control.engine.speedKmh), "Speed (0.5–30 km/h)");
        for (EditText field : new EditText[]{lat, lon, speed}) form.addView(field);
        AlertDialog dialog = new AlertDialog.Builder(dialogContext()).setTitle("Coordinates & speed").setView(form).setNegativeButton("Cancel",null).setPositiveButton("Apply",null).create();
        dialog.setOnShowListener(d -> dialog.getButton(-1).setOnClickListener(v -> {
            try {
                // Validate all fields before committing any state.
                MotionEngine check = new MotionEngine(); check.position(Double.parseDouble(lat.getText().toString().trim()), Double.parseDouble(lon.getText().toString().trim())); check.speed(Double.parseDouble(speed.getText().toString().trim()));
                Control.engine.position(check.latitude, check.longitude); Control.engine.speed(check.speedKmh);
                Control.saveState();
                Control.event("coordinates-set", check.latitude + "," + check.longitude + " speed=" + check.speedKmh); refresh(); dialog.dismiss();
            } catch (IllegalArgumentException error) { speed.setError("Enter valid coordinates and speed (0.5–30)."); }
        })); dialog.show();styleTree(form);
    }
    /** Shared World map handler for both the settings list and the quick menu Map row. */
    private void openWorldMap() {
        if(quickMenu!=null)quickMenu.hide();
        stick.release(true);
        Control.event("map-open", "Browsing does not apply a destination; current walk=" + Control.engine.walking);
        WorldMapDialog.show(activity, Control.engine.latitude, Control.engine.longitude, (lat, lon) -> {
            if (!Control.canEnable()) { Toast.makeText(activity,"Location adapter is not ready",Toast.LENGTH_SHORT).show(); return false; }
            try {
                stick.release(); Control.teleport(lat, lon);
                Control.event("map-teleport", String.format(Locale.US,"lat=%.7f lon=%.7f",lat,lon));
                refresh(); return true;
            } catch (IllegalArgumentException error) { Toast.makeText(activity,"Select valid coordinates",Toast.LENGTH_SHORT).show(); return false; }
        }, (lat, lon) -> {
            if (!Control.canEnable()) { Toast.makeText(activity,"Location adapter is not ready",Toast.LENGTH_SHORT).show(); return false; }
            try {
                stick.release(); Control.walkTo(lat, lon);
                Control.event("walk-started", String.format(Locale.US,"targetLat=%.7f targetLon=%.7f speedKmh=%.2f",lat,lon,Control.engine.speedKmh));
                if (!Control.engine.walking) Control.event("walk-arrived", "Already at selected destination");
                refresh(); return true;
            } catch (IllegalArgumentException error) { Toast.makeText(activity,"Select valid coordinates",Toast.LENGTH_SHORT).show(); return false; }
        }, (waypoints, loop) -> {
            if (!Control.canEnable()) { Toast.makeText(activity,"Location adapter is not ready",Toast.LENGTH_SHORT).show(); return false; }
            try {
                stick.release(true); Control.walkRoute(waypoints, loop);
                MotionEngine.RouteProgress progress=Control.engine.routeProgress();
                Control.event("route-started", String.format(Locale.US,"stops=%d visited=%d remainingMeters=%.2f speedKmh=%.2f loop=%s",progress.total,progress.visited,progress.remainingMeters,Control.engine.speedKmh,loop));
                refresh(); return true;
            } catch (IllegalArgumentException error) { Toast.makeText(activity,error.getMessage(),Toast.LENGTH_SHORT).show(); return false; }
        });
    }
    /** Opens the existing settings panel full screen; the game runtime is left untouched. */
    private void openSettings() {
        if(quickMenu!=null)quickMenu.hide();
        stick.release(true);
        panel.setVisibility(View.VISIBLE); panel.bringToFront(); panel.requestApplyInsets(); applyPanelInsets(parent.getRootWindowInsets());
        Control.event("settings-open", "Full-screen panel; runtime unaffected");
        refresh();
    }
    /** Shared quick teleport for the Favorites and Teleport modals; validates readiness. */
    private boolean quickTeleport(double latitude, double longitude) {
        if (!Control.canEnable()) { Toast.makeText(activity,"Location adapter is not ready",Toast.LENGTH_SHORT).show(); return false; }
        try {
            stick.release(); Control.teleport(latitude, longitude);
            Control.event("quick-teleport", String.format(Locale.US,"lat=%.7f lon=%.7f",latitude,longitude));
            refresh(); return true;
        } catch (IllegalArgumentException error) { Toast.makeText(activity,"Enter valid coordinates",Toast.LENGTH_SHORT).show(); return false; }
    }
    public void close() {
        if (closed) return;
        closed = true; stick.release(true); Control.suspendForBackground(); handler.removeCallbacks(tick);
        if(quickMenu!=null){quickMenu.destroy();quickMenu=null;}
        if(cooldownDrag!=null){cooldownDrag.detach();cooldownDrag=null;}if(vgpDrag!=null){vgpDrag.detach();vgpDrag=null;}
        parent.removeView(panel);parent.removeView(launcher);parent.removeView(joystickOverlay);if(encounterBerry!=null)parent.removeView(encounterBerry);if(cooldownTimer!=null)parent.removeView(cooldownTimer);if(vgpToggle!=null)parent.removeView(vgpToggle);if(vgpActivity!=null)parent.removeView(vgpActivity);if(vgpMarker!=null)parent.removeView(vgpMarker);
        panel.setOnApplyWindowInsetsListener(null);
        Control.event("panel-closed", "Runtime suspended on activity change; desiredEnabled=" + Control.desiredEnabled() + "; movement stopped");
    }
    private final class Stick extends View {
        final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        float x, y;
        int pointer = -1;
        long cameraGesture=-1;
        boolean gestureCamera;
        Stick(Context c) { super(c); setContentDescription("Location joystick: drag to move, release to stop"); }
        void release() { release(false); }
        void release(boolean preserveWalk) { x=y=0; pointer=-1; cameraGesture=-1; if (!preserveWalk || !Control.engine.walking) Control.engine.stop(); Control.saveState(); invalidate(); }
        void applyMotion(long now) {
            if (pointer<0) return;
            if (!Control.engine.enabled || !Control.canEnable() || gestureCamera!=Control.cameraRelative()) { release(true); return; }
            boolean wasWalking=Control.engine.walking;
            if (gestureCamera) {
                if (!Control.applyCameraInput(cameraGesture,x,-y,now)) {
                    release(true);
                    Control.event("joystick-released", "Camera unavailable or changed; a new drag is required");
                    return;
                }
            } else Control.engine.input(x,-y);
            if (wasWalking) Control.event("walk-cancelled", "Manual joystick input");
        }
        protected void onDraw(Canvas canvas) {
            float cx=getWidth()/2f, cy=getHeight()/2f, radius=Math.min(cx,cy)-dp(12);
            paint.setColor(Control.darkTheme()?0xff202e3e:0xffe1e9ef); canvas.drawCircle(cx,cy,radius,paint);
            paint.setColor(Color.rgb(72,102,125)); paint.setStrokeWidth(dp(1));
            canvas.drawLine(cx-radius,cy,cx+radius,cy,paint); canvas.drawLine(cx,cy-radius,cx,cy+radius,paint);
            paint.setColor(Control.engine.enabled?accent():muted());
            canvas.drawCircle(cx+x*radius*.65f,cy+y*radius*.65f,dp(22),paint);
        }
        public boolean onTouchEvent(MotionEvent e) {
            int action=e.getActionMasked();
            if (action==MotionEvent.ACTION_DOWN) {
                getParent().requestDisallowInterceptTouchEvent(true);
                // A deliberate manual takeover cancels even when a fresh camera
                // heading is unavailable. Passive camera loss preserves a walk.
                if (Control.engine.walking) {
                    Control.engine.stop(); Control.saveState();
                    Control.event("walk-cancelled", "Manual joystick touch");
                }
                pointer=e.getPointerId(0); gestureCamera=Control.cameraRelative();
                cameraGesture=gestureCamera ? Control.beginCameraGesture() : -1;
            }
            if (action==MotionEvent.ACTION_UP || action==MotionEvent.ACTION_CANCEL ||
                (action==MotionEvent.ACTION_POINTER_UP && e.getPointerId(e.getActionIndex())==pointer)) {
                getParent().requestDisallowInterceptTouchEvent(false);
                release(pointer<0); Control.event("joystick", "released"); return true;
            }
            int index=e.findPointerIndex(pointer); if(index<0) return true;
            float radius=Math.min(getWidth(),getHeight())/2f-dp(12);
            x=(e.getX(index)-getWidth()/2f)/radius; y=(e.getY(index)-getHeight()/2f)/radius;
            float length=(float)Math.max(1,Math.hypot(x,y)); x/=length; y/=length;
            if(Math.hypot(x,y)<0.08) x=y=0;
            applyMotion(SystemClock.elapsedRealtime()); invalidate(); return true;
        }
    }
}
