"""Build terminal-lexicon.js's model from the CLINC150 dataset (CC BY 3.0, Larson et al. 2019).
Usage: python3 tools/build-lexicon.py <clinc data_full.json> [prune_threshold=0.2] [out=model.json]
Needs scikit-learn + numpy. The model JSON is then pasted into terminal-lexicon.js (see its header).
The dataset itself is not stored in this repo."""
# intent -> family
F={}
def put(fam,*names):
    for n in names: F[n]=fam
put('greeting','greeting'); put('goodbye','goodbye'); put('thanks','thank_you')
put('yes','yes'); put('no','no'); put('maybe','maybe'); put('repeat','repeat')
put('joke','tell_joke'); put('fact','fun_fact'); put('meaning','meaning_of_life')
put('coin','flip_coin'); put('dice','roll_dice'); put('math','calculator')
put('convert','measurement_conversion','exchange_rate'); put('define','definition','spelling'); put('translate','translate')
put('date','date','next_holiday'); put('time','time','timezone')
for n in ['what_is_your_name','who_made_you','who_do_you_work_for','where_are_you_from','how_old_are_you','are_you_a_bot','do_you_have_pets','what_are_your_hobbies','change_ai_name']: put('p_'+n,n)
put('name_user','change_user_name','user_name'); put('help','what_can_i_ask_you')
put('settings','change_accent','change_language','change_speed','change_volume','whisper_mode','reset_settings','sync_device')
put('music','play_music','next_song','what_song','update_playlist')
put('weather','weather'); put('traffic','traffic','how_busy','gas'); put('place','current_location','share_location','directions','distance','find_phone')
for n in ['account_blocked','apr','balance','bill_balance','bill_due','card_declined','credit_limit','credit_limit_change','credit_score','damaged_card','direct_deposit','expiration_date','freeze_account','improve_credit_score','income','interest_rate','international_fees','min_payment','new_card','order_checks','pay_bill','payday','pin_change','redeem_rewards','replacement_card_duration','report_fraud','report_lost_card','rewards_balance','rollover_401k','routing','spending_history','taxes','transactions','transfer','w2','application_status']: put('bank',n)
for n in ['book_flight','book_hotel','car_rental','carry_on','flight_status','international_visa','lost_luggage','plug_type','travel_alert','travel_notification','travel_suggestion','uber','vaccines']: put('travel',n)
for n in ['calories','cook_time','food_last','ingredient_substitution','ingredients_list','meal_suggestion','nutrition_info','recipe','restaurant_reservation','restaurant_reviews','restaurant_suggestion','accept_reservations']: put('food',n)
for n in ['gas_type','jump_start','last_maintenance','mpg','oil_change_how','oil_change_when','schedule_maintenance','tire_change','tire_pressure']: put('car',n)
for n in ['calendar','calendar_update','meeting_schedule','schedule_meeting','pto_balance','pto_request','pto_request_status','pto_used']: put('work',n)
for n in ['alarm','reminder','reminder_update','timer','todo_list','todo_list_update','shopping_list','shopping_list_update']: put('tasks',n)
put('comms','make_call','text'); put('home','smart_home'); put('shop','order','order_status'); put('insurance','insurance','insurance_change')
put('booking','cancel','cancel_reservation','confirm_reservation')

import json,re,sys,numpy as np
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.svm import LinearSVC
d=json.load(open(sys.argv[1]))
def an(s):
    w=re.findall(r"[a-z0-9']+",s.lower()); return w+[a+'_'+b for a,b in zip(w,w[1:])]
tr=d['train']+d['val']
X=[s for s,_ in tr]; y=[F[l] for _,l in tr]
cv=CountVectorizer(analyzer=an,min_df=2,binary=True)
Xm=cv.fit_transform(X)
fams=sorted(set(y))
clf=LinearSVC(C=0.5).fit(Xm,y)
Xt=cv.transform([s for s,_ in d['test']]); yt=[F[l] for _,l in d['test']]
print('full acc',(clf.predict(Xt)==np.array(yt)).mean())
W=clf.coef_; b=clf.intercept_; vocab=cv.get_feature_names_out()
THR=float(sys.argv[2]) if len(sys.argv)>2 else 0.2
feat={}
for j,t in enumerate(vocab):
    col=W[:,j]
    e={fams[i]:round(float(col[i]),1) for i in range(len(fams)) if col[i]>=THR}
    if e: feat[t]=e
print('feat',len(feat),'bytes',len(json.dumps(feat,separators=(',',':'))))
def score(s):
    sc={f:float(b[i]) for i,f in enumerate(fams)}
    for t in set(an(s)):
        for f,x in feat.get(t,{}).items(): sc[f]+=x
    r=sorted(sc.items(),key=lambda kv:-kv[1]); return r[0][0],r[0][1],r[0][1]-r[1][1]
ok=0
for s,l in d['test']: ok+= score(s)[0]==F[l]
print('pruned acc',ok/len(d['test']))
ins=[score(s)[1] for s,_ in d['test']]; oo=[score(s)[1] for s,_ in d['oos_test']]
for th in (-0.6,-0.4,-0.2,0,0.2,0.4,0.6):
    print(th,'in kept %.3f'%(sum(x>=th for x in ins)/len(ins)),'oos rej %.3f'%(sum(x<th for x in oo)/len(oo)))
json.dump({'fams':fams,'bias':[round(float(x),2) for x in b],'feat':feat},open(sys.argv[3] if len(sys.argv)>3 else 'model.json','w'),separators=(',',':'))
