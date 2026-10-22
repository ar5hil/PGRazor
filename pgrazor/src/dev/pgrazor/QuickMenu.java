package dev.pgrazor;

import android.app.Activity;
import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.view.*;
import android.widget.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Compact vertical icon+text quick menu toggled by the R launcher (PGSharp-style).
 * Icons are drawn as canvas vectors so nothing depends on an emoji font. Theme and the
 * walking-speed caption follow {@link Control}; map/autowalk/location actions are delegated
 * to the host through {@link Listener} so map handling is never duplicated here.
 */
public final class QuickMenu {
    public interface Listener {
        void onMap();
        /** Cycles the walk speed and returns the new value (km/h); the caption refreshes from it. */
        double onCycleWalkSpeed();
        void onAutoWalk();
        void onFeeds();
        void onFavorites();
        void onTeleport();
        void onSettings();
        void onAutoCatch();
        void onAutoSpin();
    }

    static final int MAP = 0, WALK = 1, AUTOWALK = 2, FEEDS = 3, FAVORITES = 4, TELEPORT = 5, SETTINGS = 6, AUTOCATCH = 7, AUTOSPIN = 8;

    private final Activity activity;
    private final Listener listener;
    private final View anchor;
    private final FrameLayout root;
    private final LinearLayout card;
    private TextView walkLabel;
    private TextView catchLabel, spinLabel;
    private final List<TextView> rowLabels = new ArrayList<>();
    private final List<Icon> rowIcons = new ArrayList<>();
    private final List<Boolean> rowEnabled = new ArrayList<>();

    public QuickMenu(Activity activity, ViewGroup parent, View anchor, Listener listener) {
        this.activity = activity; this.anchor = anchor; this.listener = listener;
        root = new FrameLayout(activity);
        // A transparent scrim catches outside taps to dismiss without dimming the game.
        View scrim = new View(activity); scrim.setClickable(true); scrim.setOnClickListener(v -> hide());
        root.addView(scrim, new FrameLayout.LayoutParams(-1, -1));

        card = new LinearLayout(activity); card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(0, dp(6), 0, dp(6)); card.setElevation(dp(12));
        card.addView(row(MAP, "Map", true, listener::onMap));
        LinearLayout walkRow = (LinearLayout) row(WALK, "Walk", true, this::onWalk); walkLabel = (TextView) walkRow.getChildAt(1);
        card.addView(walkRow);
        LinearLayout catchRow = (LinearLayout) row(AUTOCATCH, "Auto Catch", true, listener::onAutoCatch); catchLabel = (TextView) catchRow.getChildAt(1);
        card.addView(catchRow);
        LinearLayout spinRow = (LinearLayout) row(AUTOSPIN, "Auto Spin", true, listener::onAutoSpin); spinLabel = (TextView) spinRow.getChildAt(1);
        card.addView(spinRow);
        card.addView(row(AUTOWALK, "Autowalk", true, listener::onAutoWalk));
        card.addView(row(FEEDS, "Feeds", true, listener::onFeeds));
        card.addView(row(FAVORITES, "Favorites", true, listener::onFavorites));
        card.addView(row(TELEPORT, "Teleport", true, listener::onTeleport));
        card.addView(row(SETTINGS, "Settings", true, listener::onSettings));
        root.addView(card, new FrameLayout.LayoutParams(dp(196), -2));

        parent.addView(root, new FrameLayout.LayoutParams(-1, -1));
        root.setVisibility(View.GONE);
        applyTheme();
    }

    private View row(int kind, String label, boolean enabled, Runnable action) {
        LinearLayout r = new LinearLayout(activity); r.setOrientation(LinearLayout.HORIZONTAL);
        r.setGravity(Gravity.CENTER_VERTICAL); r.setMinimumHeight(dp(48)); r.setPadding(dp(14), dp(6), dp(16), dp(6));
        Icon icon = new Icon(activity, kind); icon.disabled = !enabled;
        r.addView(icon, new LinearLayout.LayoutParams(dp(22), dp(22)));
        TextView t = new TextView(activity); t.setText(label); t.setTextSize(14.5f); t.setPadding(dp(14), 0, 0, 0);
        r.addView(t, new LinearLayout.LayoutParams(0, -2, 1f));
        if (enabled && action != null) {
            r.setClickable(true); r.setFocusable(true);
            r.setBackground(new RippleDrawable(ColorStateList.valueOf(0x3345e1ba), null, rounded(0xffffffff, 10)));
            r.setOnClickListener(v -> {if(kind!=WALK)hide();action.run();});
        }
        rowIcons.add(icon); rowLabels.add(t); rowEnabled.add(enabled);
        return r;
    }

    private void onWalk() {
        listener.onCycleWalkSpeed();
        updateWalk();
        // Keep the menu open so the user can keep cycling the speed quickly.
    }
    private void updateWalk() {
        if (walkLabel == null) return;
        double speed = Control.engine.speedKmh;
        walkLabel.setText(String.format(Locale.US, "%.1f km/h", speed));
    }
    private void updateLabels() {
        String engine = Control.autoEngine()==1 ? "native" : "VGP";
        if (catchLabel != null) catchLabel.setText("Auto Catch · "+engine+" "+(Control.autoCatchOn()?"ON":"OFF"));
        if (spinLabel != null) spinLabel.setText("Auto Spin · "+engine+" "+(Control.autoSpinOn()?"ON":"OFF"));
    }

    public void onRefresh() { if (isShowing()) updateWalk(); updateLabels(); }
    public boolean isShowing() { return root.getVisibility() == View.VISIBLE; }
    public void toggle() { if (isShowing()) hide(); else show(); }
    public void hide() { root.setVisibility(View.GONE); }
    public void show() {
        updateWalk(); updateLabels();
        root.setVisibility(View.VISIBLE); root.bringToFront();
        card.post(this::position);
    }
    private void position() {
        int cw = card.getWidth(), ch = card.getHeight(), pw = root.getWidth(), ph = root.getHeight();
        if (pw <= 0 || ph <= 0) return;
        float x = anchor.getX(), y = anchor.getY() + anchor.getHeight() + dp(8);
        if (x + cw > pw - dp(8)) x = pw - cw - dp(8);
        if (y + ch > ph - dp(8)) y = anchor.getY() - ch - dp(8);
        card.setX(Math.max(dp(8), x)); card.setY(Math.max(dp(8), y));
    }
    public void destroy() {
        hide();
        if (root.getParent() instanceof ViewGroup) ((ViewGroup) root.getParent()).removeView(root);
    }

    public void applyTheme() {
        card.setBackground(rounded(surface(), 14));
        for (int i = 0; i < rowLabels.size(); i++) {
            rowLabels.get(i).setTextColor(rowEnabled.get(i) ? ink() : muted());
            rowIcons.get(i).invalidate();
        }
    }

    private int dp(float x) { return Math.round(x * activity.getResources().getDisplayMetrics().density); }
    private int ink() { return Control.darkTheme() ? Color.rgb(235, 241, 246) : Color.rgb(25, 35, 47); }
    private int muted() { return Control.darkTheme() ? Color.rgb(154, 171, 187) : Color.rgb(88, 105, 121); }
    private int surface() { return Control.darkTheme() ? Color.rgb(20, 27, 37) : Color.rgb(249, 251, 253); }
    private GradientDrawable rounded(int color, int radius) {
        GradientDrawable d = new GradientDrawable(); d.setColor(color); d.setCornerRadius(dp(radius)); return d;
    }

    /** Small theme-aware vector glyph; disabled rows are drawn muted. */
    private final class Icon extends View {
        private final int kind;
        boolean disabled;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        Icon(Context c, int kind) { super(c); this.kind = kind; setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO); }
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float scale = Math.min(getWidth(), getHeight()) / 24f; canvas.save(); canvas.scale(scale, scale);
            paint.setColor(disabled ? muted() : ink()); paint.setStrokeCap(Paint.Cap.ROUND); paint.setStrokeJoin(Paint.Join.ROUND);
            switch (kind) {
                case MAP: {
                    paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(1.8f);
                    Path m = new Path(); m.moveTo(4, 6); m.lineTo(10, 4); m.lineTo(16, 6); m.lineTo(20, 4);
                    m.lineTo(20, 18); m.lineTo(16, 20); m.lineTo(10, 18); m.lineTo(4, 20); m.close();
                    canvas.drawPath(m, paint);
                    canvas.drawLine(10, 4, 10, 18, paint); canvas.drawLine(16, 6, 16, 20, paint);
                    break;
                }
                case WALK: {
                    paint.setStyle(Paint.Style.FILL); canvas.drawCircle(12, 5, 2.2f, paint);
                    paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(2f);
                    canvas.drawLine(12, 8, 12, 14, paint);
                    canvas.drawLine(12, 14, 9, 19, paint); canvas.drawLine(12, 14, 15, 19, paint);
                    canvas.drawLine(12, 10, 9, 13, paint); canvas.drawLine(12, 10, 15, 12, paint);
                    break;
                }
                case AUTOWALK: {
                    paint.setStyle(Paint.Style.FILL); canvas.drawCircle(13, 5, 2.2f, paint);
                    paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(2f);
                    canvas.drawLine(13, 8, 13, 14, paint);
                    canvas.drawLine(13, 14, 10, 19, paint); canvas.drawLine(13, 14, 16, 19, paint);
                    canvas.drawLine(13, 10, 16, 12, paint);
                    paint.setStrokeWidth(1.6f);
                    canvas.drawLine(3, 9, 7, 9, paint); canvas.drawLine(2, 12, 6, 12, paint); canvas.drawLine(3, 15, 7, 15, paint);
                    break;
                }
                case FEEDS: {
                    paint.setStyle(Paint.Style.FILL); canvas.drawCircle(6.5f, 17.5f, 1.8f, paint);
                    paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(2f);
                    canvas.drawArc(new RectF(5 - 5, 19 - 5, 5 + 5, 19 + 5), -90, 90, false, paint);
                    canvas.drawArc(new RectF(5 - 9, 19 - 9, 5 + 9, 19 + 9), -90, 90, false, paint);
                    break;
                }
                case FAVORITES: {
                    paint.setStyle(Paint.Style.FILL);
                    Path star = new Path(); float cx = 12, cy = 12, ro = 8, ri = 3.4f;
                    for (int i = 0; i < 10; i++) {
                        double ang = Math.toRadians(-90 + i * 36); float rr = (i % 2 == 0) ? ro : ri;
                        float px = cx + rr * (float) Math.cos(ang), py = cy + rr * (float) Math.sin(ang);
                        if (i == 0) star.moveTo(px, py); else star.lineTo(px, py);
                    }
                    star.close(); canvas.drawPath(star, paint);
                    break;
                }
                case TELEPORT: {
                    paint.setStyle(Paint.Style.FILL);
                    Path nav = new Path(); nav.moveTo(12, 3.5f); nav.lineTo(19.5f, 19.5f); nav.lineTo(12, 15.5f); nav.lineTo(4.5f, 19.5f); nav.close();
                    canvas.drawPath(nav, paint);
                    break;
                }
                case AUTOCATCH: {
                    paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(1.8f);
                    canvas.drawCircle(12, 12, 7.5f, paint);
                    canvas.drawLine(4.5f, 12, 19.5f, 12, paint);
                    paint.setStyle(Paint.Style.FILL); canvas.drawCircle(12, 12, 2.2f, paint);
                    break;
                }
                case AUTOSPIN: {
                    paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(1.9f);
                    canvas.drawArc(new RectF(4, 4, 20, 20), -55, 285, false, paint);
                    paint.setStyle(Paint.Style.FILL);
                    Path arrow = new Path(); arrow.moveTo(19.5f, 3.5f); arrow.lineTo(21, 9); arrow.lineTo(15.8f, 7.2f); arrow.close();
                    canvas.drawPath(arrow, paint);
                    break;
                }
                case SETTINGS: {
                    paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(2f);
                    for (int i = 0; i < 8; i++) {
                        double ang = Math.toRadians(i * 45); float c = (float) Math.cos(ang), s2 = (float) Math.sin(ang);
                        canvas.drawLine(12 + c * 5.5f, 12 + s2 * 5.5f, 12 + c * 8f, 12 + s2 * 8f, paint);
                    }
                    canvas.drawCircle(12, 12, 5.2f, paint); canvas.drawCircle(12, 12, 1.8f, paint);
                    break;
                }
            }
            canvas.restore();
        }
    }
}
