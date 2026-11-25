package br.com.horaextra.tv;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.net.Uri;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.Toast;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.JavaScriptReplyProxy;
import org.json.JSONObject;
import java.io.InputStream;
import java.util.*;

public class MainActivity extends Activity {
    private static final String HOST="adega-digital.jeff1995ssp1.workers.dev";
    private static final String ORIGIN="https://"+HOST;
    private static final String URL=ORIGIN+"/tv.html";
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Locale locale=new Locale("pt","BR");
    private WebView web;
    private TextToSpeech tts;
    private boolean initialized=false, initDone=false;
    private ToneGenerator tone;
    private long sequence=0;
    private Request current;
    private static class Request {
        String id,text,voice,utterance;
        float volume,rate;
        JavaScriptReplyProxy reply;
        long seq;
        int attempt;
    }
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(5894);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        web=new WebView(this); setContentView(web);
        WebSettings s=web.getSettings();
        s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setUseWideViewPort(true);s.setLoadWithOverviewMode(true);s.setTextZoom(100);s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){return req.isForMainFrame()&&!trusted(req.getUrl());}
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return !trusted(Uri.parse(url));}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest req){
                Uri u=req.getUrl();
                if(trusted(u)&&"/js/tv.js".equals(u.getPath())){
                    try{InputStream input=getAssets().open("tv-app.js");
                        return new WebResourceResponse("application/javascript","UTF-8",input);
                    }catch(Exception ignored){}
                }
                return null;
            }
            @Override public void onReceivedError(WebView v,WebResourceRequest req,WebResourceError error){
                if(req.isForMainFrame())handler.postDelayed(()->{if(web!=null)web.loadUrl(URL);},15000);
            }
        });
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){
            WebViewCompat.addWebMessageListener(web,"HoraNative",Collections.singleton(ORIGIN),
                (view,message,origin,mainFrame,reply)->{
                    if(!mainFrame||!trusted(origin))return;
                    try{
                        JSONObject o=new JSONObject(message.getData());
                        if("stop".equals(o.optString("action"))){stop();return;}
                        if(!"speak".equals(o.optString("action")))return;
                        Request q=new Request();q.id=o.getString("id");q.text=o.getString("text");
                        if(q.text.length()>350||q.text.isEmpty())return;
                        q.voice=o.optString("voice","female");q.volume=clamp(o.optDouble("volume",1),0,1);q.rate=clamp(o.optDouble("rate",.95),.7,1.3);
                        q.reply=reply;start(q);
                    }catch(Exception ignored){}
                });
        }
        try{tone=new ToneGenerator(AudioManager.STREAM_MUSIC,65);}catch(Exception ignored){}
        tts=new TextToSpeech(this,status->handler.post(()->{
            initDone=true;initialized=status==TextToSpeech.SUCCESS&&tts!=null;
            if(initialized){
                tts.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){
                    @Override public void onStart(String id){}
                    @Override public void onDone(String id){handler.post(()->completed(id,true));}
                    @Override public void onError(String id){handler.post(()->completed(id,false));}
                    @Override public void onError(String id,int error){onError(id);}
                });
            }
            if(current!=null){Request q=current;if(initialized)play(q);else finish(q,false);}
        }));
        web.loadUrl(URL);
    }
    private static boolean trusted(Uri uri){return uri!=null&&"https".equals(uri.getScheme())&&HOST.equalsIgnoreCase(uri.getHost())&&(uri.getPort()==-1||uri.getPort()==443);}
    private static float clamp(double v,double lo,double hi){return (float)Math.max(lo,Math.min(hi,v));}
    private void stop(){sequence++;current=null;if(tts!=null)tts.stop();if(tone!=null)tone.stopTone();}
    private void start(Request q){
        stop();q.seq=sequence;current=q;
        if(!initDone)return;
        if(!initialized){finish(q,false);return;}
        if(tone!=null&&q.volume>0)try{tone.startTone(ToneGenerator.TONE_PROP_BEEP,150);}catch(Exception ignored){}
        handler.postDelayed(()->{if(current==q)play(q);},180);
    }
    private Voice pick(Request q,boolean offline){
        Set<Voice> voices=tts.getVoices();if(voices==null)return null;
        Voice best=null;int score=Integer.MIN_VALUE;
        for(Voice v:voices){
            if(v.getLocale()==null||!"pt".equals(v.getLocale().getLanguage()))continue;
            if(offline&&v.isNetworkConnectionRequired())continue;
            if(v.getFeatures()!=null&&v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))continue;
            String n=v.getName().toLowerCase(Locale.ROOT);
            boolean male=n.matches(".*(male|masculin|daniel|ricardo|paulo|joao|felipe).*")&&!n.contains("female");
            boolean female=n.matches(".*(female|feminin|luciana|fernanda|maria|vitoria).*");
            int x=v.getQuality()+("BR".equals(v.getLocale().getCountry())?1000:0)+(q.voice.equals("male")&&male||q.voice.equals("female")&&female?500:0)+(offline?0:v.isNetworkConnectionRequired()?350:0)-v.getLatency()/10;
            if(x>score){score=x;best=v;}
        }
        return best;
    }
    private void play(Request q){
        if(current!=q)return;
        try{
            boolean offline=q.attempt>0;
            Voice voice=pick(q,offline);
            if(voice==null||tts.setVoice(voice)!=TextToSpeech.SUCCESS){
                if(offline){finish(q,false);return;}
                if(tts.setLanguage(locale)<TextToSpeech.LANG_AVAILABLE){finish(q,false);return;}
            }
            tts.setSpeechRate(q.rate);tts.setPitch(1.0f);
            Bundle params=new Bundle();params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME,q.volume);
            q.utterance="hora-"+q.seq+"-"+q.attempt;
            int result=tts.speak(q.text,TextToSpeech.QUEUE_FLUSH,params,q.utterance);
            if(result!=TextToSpeech.SUCCESS){completed(q.utterance,false);return;}
            String id=q.utterance;
            handler.postDelayed(()->{if(current==q&&id.equals(q.utterance)){tts.stop();completed(id,false);}},q.attempt==0?20000:20000);
        }catch(Exception e){if(q.attempt++==0)play(q);else finish(q,false);}
    }
    private void completed(String id,boolean ok){
        Request q=current;if(q==null||!id.equals(q.utterance))return;
        if(!ok&&q.attempt++==0){play(q);return;}
        finish(q,ok);
    }
    private void finish(Request q,boolean ok){
        if(current!=q)return;current=null;
        try{q.reply.postMessage(new JSONObject().put("id",q.id).put("ok",ok).toString());}catch(Exception ignored){}
    }
    @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(focus)getWindow().getDecorView().setSystemUiVisibility(5894);}
    @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onDestroy(){stop();handler.removeCallbacksAndMessages(null);if(tts!=null)tts.shutdown();if(tone!=null)tone.release();if(web!=null){web.destroy();web=null;}super.onDestroy();}
}
