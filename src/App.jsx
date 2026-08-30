import { useState, useCallback, useMemo, useEffect } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, AreaChart, Area, Legend
} from "recharts";
import {
  isConfigured, signIn, signUp, signOut, restoreSession
} from "./lib/supabaseClient.js";
import * as api from "./lib/api.js";

// ── THEME ─────────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg:"#07071a", card:"#12122b", border:"#22224a", text:"#eee8ff",
    sub:"#8070b0", accent:"#7c5cfc", accent2:"#ff6b9d", green:"#00d4aa",
    amber:"#ffd60a", red:"#ff4d6d", nav:"#0c0c23", input:"#1a1a38"
  },
  light: {
    bg:"#f4f1ff", card:"#ffffff", border:"#ddd6ff", text:"#100028",
    sub:"#6b5a9a", accent:"#6c3fff", accent2:"#ff4d8f", green:"#00b894",
    amber:"#e6a817", red:"#e74c3c", nav:"#ffffff", input:"#f0ecff"
  }
};

// ── CATEGORIES ────────────────────────────────────────────────────────────────
const CATS = [
  {id:"food",     label:"Food",        icon:"🍕", color:"#ff6b6b"},
  {id:"transport",label:"Transport",   icon:"🚌", color:"#ffc200"},
  {id:"education",label:"Education",   icon:"📚", color:"#4fc3f7"},
  {id:"shopping", label:"Shopping",    icon:"🛒", color:"#ce93d8"},
  {id:"entertain",label:"Fun",         icon:"🎮", color:"#ff8f00"},
  {id:"health",   label:"Health",      icon:"💊", color:"#00d4aa"},
  {id:"rent",     label:"Rent",        icon:"🏠", color:"#7c5cfc"},
  {id:"groceries",label:"Groceries",   icon:"🛒", color:"#66bb6a"},
  {id:"recharge", label:"Recharge",    icon:"📱", color:"#26c6da"},
  {id:"snacks",   label:"Snacks",      icon:"☕", color:"#a1887f"},
  {id:"clothing", label:"Clothing",    icon:"👕", color:"#ef5350"},
  {id:"sports",   label:"Sports",      icon:"🏃", color:"#42a5f5"},
  {id:"travel",   label:"Travel",      icon:"✈", color:"#26a69a"},
  {id:"gifts",    label:"Gifts",       icon:"🎁", color:"#ec407a"},
  {id:"salary",   label:"Income",      icon:"💰", color:"#66bb6a"},
  {id:"other",    label:"Other",       icon:"📦", color:"#90a4ae"},
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FMONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt   = n => "₹" + Number(n||0).toLocaleString("en-IN");
const uid   = () => Math.random().toString(36).slice(2,10);
const today = () => new Date().toISOString().split("T")[0];
const getcat= id => CATS.find(c=>c.id===id) || CATS[CATS.length-1];

// ── BASE UI ───────────────────────────────────────────────────────────────────
function Card({children, style={}, th, glow}) {
  return (
    <div style={{
      background:th.card, borderRadius:20, border:`1px solid ${th.border}`,
      padding:20, boxShadow: glow ? `0 4px 28px ${glow}28` : "0 2px 12px rgba(0,0,0,0.1)",
      ...style
    }}>{children}</div>
  );
}

function Avi({user, size=36, th}) {
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%",
      background:`linear-gradient(135deg,${user.color},${user.color}99)`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.46, flexShrink:0,
      border:`2px solid ${th.border}`, boxShadow:`0 0 0 3px ${user.color}22`
    }}>{user.avatar}</div>
  );
}

function Pill({children, color}) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:3, padding:"3px 9px",
      borderRadius:99, fontSize:11, fontWeight:700, color, background:`${color}1a`
    }}>{children}</span>
  );
}

function Btn({children, onClick, color="#7c5cfc", outline, full, sm, lg, style={}, disabled}) {
  const pad = lg ? "14px 26px" : sm ? "7px 14px" : "11px 20px";
  const fs  = lg ? 16 : sm ? 12 : 14;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:pad, fontSize:fs, fontWeight:700, borderRadius:12, cursor:disabled?"not-allowed":"pointer",
      border: outline ? `2px solid ${color}` : "none",
      background: outline ? "transparent" : `linear-gradient(135deg,${color},${color}cc)`,
      color: outline ? color : "#fff",
      width: full ? "100%" : undefined,
      boxShadow: outline ? "none" : `0 4px 16px ${color}38`,
      opacity: disabled ? 0.55 : 1,
      transition:"all .18s", fontFamily:"inherit", ...style
    }}>{children}</button>
  );
}

function Inp({label, type="text", value, onChange, icon, placeholder, th, style={}, rightEl}) {
  const [f,setF] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const inputRef = useCallback(node => {
    if (node && type === "date") {
      node.onclick = () => { if (node.showPicker) node.showPicker(); };
    }
  }, [type]);

  const actualType = type === "password" ? (showPass ? "text" : "password") : type;

  return (
    <div style={{marginBottom:14}}>
      {label && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <label style={{fontSize:12,color:th.sub,display:"block",fontWeight:700,textTransform:"uppercase",letterSpacing:".4px"}}>{label}</label>
          {rightEl}
        </div>
      )}
      <div style={{position:"relative"}}>
        {icon && <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16,pointerEvents:"none"}}>{icon}</span>}
        <input ref={inputRef} type={actualType} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          onFocus={()=>setF(true)} onBlur={()=>setF(false)}
          style={{
            width:"100%", boxSizing:"border-box",
            padding: icon ? (type === "password" ? "12px 42px 12px 38px" : "12px 14px 12px 38px") : (type === "password" ? "12px 42px 12px 14px" : "12px 14px"),
            background:th.input, border:`2px solid ${f?"#7c5cfc":th.border}`,
            borderRadius:12, color:th.text, fontSize:15, outline:"none",
            transition:"border-color .2s", fontFamily:"inherit", cursor: type==="date"?"pointer":"text", ...style
          }}/>
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShowPass(s => !s)}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", fontSize: 16, color: th.sub,
              padding: 2, display: "flex", alignItems: "center", justifyContent: "center"
            }}
            title={showPass ? "Hide password" : "Show password"}
          >
            {showPass ? "👁️" : "🙈"}
          </button>
        )}
      </div>
    </div>
  );
}

function Modal({title, onClose, children, th}) {
  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16
    }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        background:th.card,borderRadius:24,padding:24,width:"100%",maxWidth:480,
        boxShadow:"0 24px 60px rgba(0,0,0,.5)",border:`1px solid ${th.border}`,
        maxHeight:"90vh",overflowY:"auto"
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{margin:0,fontSize:18,fontWeight:800,color:th.text}}>{title}</h3>
          <button onClick={onClose} style={{background:`${th.sub}18`,border:"none",width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:15,color:th.sub}}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function AuthPage({onLogin, onRegister, th}) {
  const [tab,setTab]   = useState("login");
  const [email,setEmail] = useState("");
  const [pass,setPass]   = useState("");
  const [name,setName]   = useState("");
  const [err,setErr]     = useState("");
  const [ok,setOk]       = useState("");
  const [busy,setBusy]   = useState(false);

  const run = async (fn) => {
    setBusy(true); setErr(""); setOk("");
    try { return await fn(); }
    catch (e) { setErr(e.message || "Something went wrong. Try again."); }
    finally { setBusy(false); }
  };

  const doLogin = () => run(async () => {
    if(!email.trim() || !pass) return setErr("Enter your email and password.");
    await onLogin(email, pass);
  });

  const doReg = () => run(async () => {
    if(!name.trim()||!email.trim()||!pass.trim()) return setErr("Fill all fields.");
    if(pass.length<6) return setErr("Password must be 6+ characters.");
    const res = await onRegister(name, email, pass);
    if(res?.needsConfirmation) {
      setOk("Account created. Check your email to confirm, then sign in.");
      setTab("login"); setPass("");
    }
  });

  const submit = tab==="login" ? doLogin : doReg;
  const onKey = e => { if(e.key === "Enter" && !busy) submit(); };

  return (
    <div onKeyDown={onKey} style={{minHeight:"100vh",background:th.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"Inter,system-ui,sans-serif",position:"relative",overflow:"hidden"}}>
      {/* glow orbs */}
      {[["#7c5cfc","-15%","-10%",500],["#ff6b9d","75%","65%",380],["#00d4aa","80%","-5%",280]].map(([c,top,left,s],i)=>
        <div key={i} style={{position:"absolute",top,left,width:s,height:s,borderRadius:"50%",background:`radial-gradient(circle,${c}18,transparent 70%)`,pointerEvents:"none"}}/>
      )}
      <div style={{textAlign:"center",marginBottom:36,position:"relative"}}>
        <div style={{fontSize:58,marginBottom:8,filter:"drop-shadow(0 4px 12px #7c5cfc55)"}}>💸</div>
        <h1 style={{fontSize:36,fontWeight:900,color:th.text,margin:0,letterSpacing:-1.5}}>XpenseUp</h1>
        <p style={{color:th.sub,margin:"8px 0 0",fontSize:15}}>Smart money tracking for students 🎓</p>
      </div>
      <div style={{width:"100%",maxWidth:420}}>
        <Card th={th} glow="#7c5cfc">
          {/* Tabs */}
          <div style={{display:"flex",background:th.input,borderRadius:14,padding:4,marginBottom:24}}>
            {["login","register"].map(t=>(
              <button key={t} onClick={()=>{setTab(t);setErr("");setOk("");}} style={{
                flex:1,padding:"10px",borderRadius:11,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:"inherit",transition:"all .2s",
                background:tab===t?"linear-gradient(135deg,#7c5cfc,#ff6b9d)":"transparent",
                color:tab===t?"#fff":th.sub
              }}>{t==="login"?"🔑 Sign In":"✨ Register"}</button>
            ))}
          </div>
          {ok  && <div style={{padding:"10px 14px",background:"#00d4aa1a",borderRadius:12,color:"#00d4aa",marginBottom:16,fontSize:14,fontWeight:600}}>✅ {ok}</div>}
          {err && <div style={{padding:"10px 14px",background:"#ff4d6d1a",borderRadius:12,color:"#ff4d6d",marginBottom:16,fontSize:14}}>{err}</div>}
          {tab==="register" && <Inp label="Full Name" value={name} onChange={setName} icon="👤" placeholder="Your name" th={th}/>}
          <Inp label="Email" type="email" value={email} onChange={setEmail} icon="✉" placeholder="you@email.com" th={th}/>
          <Inp label="Password" type="password" value={pass} onChange={setPass} icon="🔒" placeholder="Min 6 characters" th={th}/>
          <Btn onClick={submit} full color="#7c5cfc" lg disabled={busy} style={{marginTop:4}}>
            {busy ? "Please wait…" : tab==="login" ? "Sign In →" : "Create Account →"}
          </Btn>
          <p style={{textAlign:"center",color:th.sub,fontSize:12,marginTop:16,marginBottom:0,lineHeight:1.6}}>
            ☁ Your data is stored in the cloud — sign in from any device.<br/>
            Demo: <strong style={{color:th.accent}}>arjun@demo.com</strong> · <strong>demo123</strong>
          </p>
        </Card>
      </div>
    </div>
  );
}

// ── ADD / EDIT EXPENSE ────────────────────────────────────────────────────────
function ExpenseModal({onClose, onSave, th, initial}) {
  const edit = !!initial;
  const [type,setType]   = useState(initial?.type||"debit");
  const [amount,setAmt] = useState(initial?String(initial.amount):"");
  const [category,setCat]= useState(initial?.category||"food");
  const [note,setNote]   = useState(initial?.note||"");
  const [date,setDate]   = useState(initial?.date||today());
  const [err,setErr]     = useState("");

  const debitCats  = CATS.filter(c=>c.id!=="salary");
  const creditCats = CATS.filter(c=>["salary","other","gifts"].includes(c.id));
  const visCats    = type==="credit" ? creditCats : debitCats;

  const save = () => {
    if(!amount||isNaN(amount)||+amount<=0) return setErr("Enter a valid amount.");
    onSave({id:initial?.id||uid(), type, amount:+amount, category, note, date});
    onClose();
  };

  return (
    <Modal title={edit?"✏ Edit Transaction":"➕ Add Transaction"} onClose={onClose} th={th}>
      {/* Type */}
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        {["debit","credit"].map(t=>(
          <button key={t} onClick={()=>{setType(t);if(t==="credit")setCat("salary");}} style={{
            flex:1,padding:"13px",borderRadius:14,border:"none",cursor:"pointer",fontWeight:700,fontSize:15,fontFamily:"inherit",transition:"all .2s",
            background:type===t?(t==="debit"?"linear-gradient(135deg,#ff4d6d,#ff8a9a)":"linear-gradient(135deg,#00d4aa,#00ffcc)"):`${th.input}`,
            color:type===t?"#fff":th.sub,
            boxShadow:type===t?`0 4px 14px ${t==="debit"?"#ff4d6d":"#00d4aa"}44`:"none"
          }}>{t==="debit"?"💸 Expense":"💰 Income"}</button>
        ))}
      </div>
      {/* Amount */}
      <div style={{marginBottom:16}}>
        <label style={{fontSize:12,color:th.sub,marginBottom:5,display:"block",fontWeight:700,textTransform:"uppercase",letterSpacing:".4px"}}>Amount</label>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:20,fontWeight:800,color:th.accent,pointerEvents:"none"}}>₹</span>
          <input type="number" value={amount} onChange={e=>setAmt(e.target.value)} placeholder="0"
            style={{width:"100%",boxSizing:"border-box",padding:"14px 14px 14px 40px",background:th.input,border:`2px solid ${th.border}`,borderRadius:14,color:th.text,fontSize:24,fontWeight:800,outline:"none",fontFamily:"inherit"}}
            onFocus={e=>e.target.style.borderColor="#7c5cfc"} onBlur={e=>e.target.style.borderColor=th.border}/>
        </div>
      </div>
      {/* Category grid */}
      <div style={{marginBottom:16}}>
        <label style={{fontSize:12,color:th.sub,marginBottom:8,display:"block",fontWeight:700,textTransform:"uppercase",letterSpacing:".4px"}}>Category</label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
          {visCats.map(c=>(
            <button key={c.id} onClick={()=>setCat(c.id)} style={{
              padding:"9px 4px",borderRadius:11,border:`2px solid ${category===c.id?c.color:th.border}`,
              background:category===c.id?`${c.color}22`:th.input,cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              fontSize:10,color:th.text,fontWeight:category===c.id?700:400,transition:"all .15s",fontFamily:"inherit"
            }}>
              <span style={{fontSize:20}}>{c.icon}</span>
              <span style={{textAlign:"center",lineHeight:1.2}}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
      <Inp label="Note (optional)" value={note} onChange={setNote} icon="📝" placeholder="What was it for?" th={th}/>
      <Inp 
        label="Date" 
        type="date" 
        value={date} 
        onChange={setDate} 
        icon="📅" 
        th={th}
        rightEl={
          <div style={{display:"flex",gap:6}}>
            <button type="button" onClick={()=>{
              const d = new Date(); d.setDate(d.getDate()-1);
              setDate(d.toISOString().split("T")[0]);
            }} style={{
              background: date === new Date(Date.now() - 86400000).toISOString().split("T")[0] ? `${th.accent}33` : `${th.sub}18`,
              border: `1px solid ${th.border}`, color: th.text, borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
            }}>⏮ Yesterday</button>
            <button type="button" onClick={()=>setDate(today())} style={{
              background: date === today() ? `${th.accent}33` : `${th.sub}18`,
              border: `1px solid ${th.accent}`, color: th.accent, borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
            }}>⚡ Today</button>
          </div>
        }
      />
      {err && <p style={{color:"#ff4d6d",fontSize:13,margin:"0 0 10px"}}>{err}</p>}
      <div style={{display:"flex",gap:10,marginTop:8}}>
        <Btn onClick={onClose} outline color={th.sub} full>Cancel</Btn>
        <Btn onClick={save} color={type==="debit"?"#ff4d6d":"#00d4aa"} full>{edit?"Save Changes":type==="debit"?"Add Expense":"Add Income"}</Btn>
      </div>
    </Modal>
  );
}

// ── GROUP MODAL ───────────────────────────────────────────────────────────────
// Members are added by typing their exact email. The lookup runs through a
// database function that only ever matches in full and never returns emails,
// so the app can't be used to browse other people's accounts.
function GroupModal({onClose, onSave, th, me, onFindUser}) {
  const [step,setStep]   = useState(1);
  const [gname,setGname] = useState("");
  const [invited,setInv] = useState([]);
  const [mail,setMail]   = useState("");
  const [desc,setDesc]   = useState("");
  const [amt,setAmt]     = useState("");
  const [err,setErr]     = useState("");
  const [busy,setBusy]   = useState(false);

  const headcount = invited.length + 1;
  const perHead   = amt ? (+amt/headcount).toFixed(2) : 0;

  const addMember = async () => {
    const email = mail.trim().toLowerCase();
    if(!email) return;
    if(email === me.email.toLowerCase()) return setErr("You're already in the group.");
    if(invited.some(u=>u.id && email && u.email === email)) return setErr("Already added.");
    setBusy(true); setErr("");
    try {
      const found = await onFindUser(email);
      if(!found) return setErr(`No XpenseUp account for ${email}. Ask them to register first.`);
      if(found.id === me.id || invited.some(u=>u.id===found.id)) return setErr("Already added.");
      setInv(p=>[...p,{...found,email}]); setMail("");
    } catch(e) {
      setErr(e.message || "Lookup failed.");
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setErr("");
    try {
      await onSave({
        name: gname,
        memberIds: invited.map(u=>u.id),
        firstExpense: desc && +amt>0 ? {description:desc, amount:+amt, paidBy:me.id} : null
      });
      onClose();
    } catch(e) {
      setErr(e.message || "Could not create the group.");
      setBusy(false);
    }
  };

  return (
    <Modal title={step===1?"👥 Create Group":"💸 First Expense (optional)"} onClose={onClose} th={th}>
      {step===1 ? (
        <>
          <Inp label="Group Name" value={gname} onChange={setGname} icon="👥" placeholder="Flat mates, Trip to Goa..." th={th}/>
          <div style={{marginBottom:18}}>
            <label style={{fontSize:12,color:th.sub,marginBottom:8,display:"block",fontWeight:700,textTransform:"uppercase",letterSpacing:".4px"}}>Add Members By Email</label>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input value={mail} onChange={e=>setMail(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addMember(); } }}
                type="email" placeholder="friend@email.com"
                style={{flex:1,boxSizing:"border-box",padding:"12px 14px",background:th.input,border:`2px solid ${th.border}`,borderRadius:12,color:th.text,fontSize:15,outline:"none",fontFamily:"inherit"}}/>
              <Btn onClick={addMember} color="#7c5cfc" disabled={busy}>{busy?"…":"Add"}</Btn>
            </div>
            {/* Self */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,border:`2px solid ${me.color}`,background:`${me.color}18`,marginBottom:8,opacity:.85}}>
              <Avi user={me} size={36} th={th}/>
              <div style={{flex:1}}><div style={{fontWeight:700,color:th.text}}>{me.name} (You)</div></div>
              <div style={{width:22,height:22,borderRadius:"50%",background:me.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13}}>✓</div>
            </div>
            {invited.map(u=>(
              <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,border:`2px solid ${u.color}`,background:`${u.color}18`,marginBottom:8}}>
                <Avi user={u} size={36} th={th}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,color:th.text}}>{u.name}</div>
                  <div style={{fontSize:12,color:th.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.email}</div>
                </div>
                <button onClick={()=>setInv(p=>p.filter(x=>x.id!==u.id))} style={{background:`${th.sub}18`,border:"none",width:28,height:28,borderRadius:"50%",cursor:"pointer",fontSize:14,color:th.sub}}>&times;</button>
              </div>
            ))}
            {invited.length===0 && <p style={{color:th.sub,fontSize:13,margin:"4px 0 0",lineHeight:1.6}}>Add the people you're splitting with. They'll see this group when they sign in on their own device.</p>}
          </div>
          {err && <p style={{color:"#ff4d6d",fontSize:13,margin:"0 0 10px"}}>{err}</p>}
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={onClose} outline color={th.sub} full>Cancel</Btn>
            <Btn onClick={()=>{if(!gname.trim())return setErr("Name required.");setErr("");setStep(2);}} color="#7c5cfc" full>Next →</Btn>
          </div>
        </>
      ) : (
        <>
          <div style={{padding:"12px 16px",borderRadius:14,background:"#7c5cfc18",marginBottom:20,border:"1px solid #7c5cfc44"}}>
            <div style={{fontWeight:800,color:th.text,fontSize:16}}>👥 {gname}</div>
            <div style={{fontSize:13,color:th.sub,marginTop:3}}>{headcount} member{headcount!==1?"s":""}</div>
          </div>
          <Inp label="Expense description (optional)" value={desc} onChange={setDesc} icon="📝" placeholder="Hotel, Dinner..." th={th}/>
          <Inp label="Total amount ₹ (optional)" type="number" value={amt} onChange={setAmt} icon="₹" placeholder="0" th={th}/>
          {amt>0 && <div style={{padding:"10px 14px",borderRadius:12,background:"#00d4aa18",marginBottom:14,border:"1px solid #00d4aa44"}}>
            <p style={{margin:0,fontSize:14,color:"#00d4aa",fontWeight:700}}>Each pays: {fmt(perHead)} ({headcount} people)</p>
          </div>}
          {err && <p style={{color:"#ff4d6d",fontSize:13,margin:"0 0 10px"}}>{err}</p>}
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={()=>setStep(1)} outline color={th.sub} full disabled={busy}>← Back</Btn>
            <Btn onClick={save} color="#7c5cfc" full disabled={busy}>{busy?"Creating…":"Create Group 🎉"}</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({expenses, budget, groups, me, th, onNav}) {
  const now = new Date(); const m = now.getMonth(); const y = now.getFullYear();
  const thisM  = expenses.filter(e=>{ const d=new Date(e.date); return d.getMonth()===m&&d.getFullYear()===y; });
  const debit  = thisM.filter(e=>e.type==="debit" ).reduce((s,e)=>s+e.amount,0);
  const credit = thisM.filter(e=>e.type==="credit").reduce((s,e)=>s+e.amount,0);
  const bPct   = budget ? Math.min((debit/budget)*100,100) : 0;
  const recent = [...expenses].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);

  const catData = CATS.filter(c=>c.id!=="salary")
    .map(c=>({...c, val:thisM.filter(e=>e.category===c.id&&e.type==="debit").reduce((s,e)=>s+e.amount,0)}))
    .filter(c=>c.val>0).sort((a,b)=>b.val-a.val);

  const myGroups= groups.filter(g=>g.members.includes(me.id));
  const owed    = myGroups.reduce((s,g)=>s+g.expenses.reduce((es,ex)=>{ const sp=ex.splits?.find(sp=>sp.userId===me.id); return es+(sp&&!sp.settled&&ex.paidBy!==me.id?sp.amount:0); },0),0);
  const lent    = myGroups.reduce((s,g)=>s+g.expenses.reduce((es,ex)=>{ const oth=ex.splits?.filter(sp=>sp.userId!==me.id&&!sp.settled)||[]; return es+(ex.paidBy===me.id?oth.reduce((o,sp)=>o+sp.amount,0):0); },0),0);

  const hr = now.getHours();
  const greet = hr<12?"Good Morning ☀":hr<17?"Good Afternoon 🌤":"Good Evening 🌙";

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:13,color:th.sub,fontWeight:600}}>{greet}</div>
        <h2 style={{margin:"4px 0 2px",fontSize:24,fontWeight:900,color:th.text}}>{me.name.split(" ")[0]}'s Dashboard</h2>
        <p style={{margin:0,color:th.sub,fontSize:14}}>{FMONTHS[m]} {y}</p>
      </div>

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        {[
          {label:"Total Spent", val:debit,          icon:"💸", color:"#ff4d6d"},
          {label:"Total Income",val:credit,          icon:"💰", color:"#00d4aa"},
          {label:"Net Balance", val:credit-debit,    icon:"⚖", color:"#7c5cfc"},
          {label:"Budget Left", val:Math.max((budget||0)-debit,0), icon:"🎯", color:"#ffd60a"},
        ].map(c=>(
          <div key={c.label} style={{borderRadius:18,padding:"16px 14px",background:`linear-gradient(135deg,${c.color}1a,${c.color}08)`,border:`1px solid ${c.color}28`}}>
            <div style={{fontSize:22,marginBottom:6}}>{c.icon}</div>
            <div style={{fontSize:11,color:th.sub,fontWeight:700,marginBottom:3,textTransform:"uppercase"}}>{c.label}</div>
            <div style={{fontSize:19,fontWeight:900,color:c.color}}>{fmt(c.val)}</div>
          </div>
        ))}
      </div>

      {/* Budget bar */}
      {budget>0 && (
        <Card th={th} style={{marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div>
              <div style={{fontWeight:800,fontSize:15,color:th.text}}>🎯 Monthly Budget</div>
              <div style={{fontSize:13,color:th.sub,marginTop:2}}>{fmt(debit)} of {fmt(budget)}</div>
            </div>
            <Pill color={bPct>90?"#ff4d6d":bPct>70?"#ffd60a":"#00d4aa"}>{bPct.toFixed(0)}%</Pill>
          </div>
          <div style={{height:10,borderRadius:99,background:th.border,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${bPct}%`,borderRadius:99,transition:"width .6s",
              background:bPct>90?"linear-gradient(90deg,#ff4d6d,#ff9a9a)":bPct>70?"linear-gradient(90deg,#ffd60a,#ffe980)":"linear-gradient(90deg,#00d4aa,#00ffcc)"
            }}/>
          </div>
          {bPct>90 && <p style={{margin:"8px 0 0",fontSize:13,color:"#ff4d6d",fontWeight:700}}>⚠ Almost at your limit!</p>}
        </Card>
      )}

      {/* Split summary */}
      {(owed>0||lent>0) && (
        <Card th={th} style={{marginBottom:18}}>
          <div style={{fontWeight:800,fontSize:15,color:th.text,marginBottom:12}}>💳 Split Balances</div>
          <div style={{display:"flex",gap:12}}>
            {owed>0 && <div style={{flex:1,padding:"12px",borderRadius:14,background:"#ff4d6d18",border:"1px solid #ff4d6d28"}}>
              <div style={{fontSize:11,color:th.sub,fontWeight:700,textTransform:"uppercase"}}>You Owe</div>
              <div style={{fontSize:20,fontWeight:900,color:"#ff4d6d",marginTop:4}}>{fmt(owed)}</div>
            </div>}
            {lent>0 && <div style={{flex:1,padding:"12px",borderRadius:14,background:"#00d4aa18",border:"1px solid #00d4aa28"}}>
              <div style={{fontSize:11,color:th.sub,fontWeight:700,textTransform:"uppercase"}}>You'll Get</div>
              <div style={{fontSize:20,fontWeight:900,color:"#00d4aa",marginTop:4}}>{fmt(lent)}</div>
            </div>}
          </div>
        </Card>
      )}

      {/* Pie chart */}
      {catData.length>0 && (
        <Card th={th} style={{marginBottom:18}}>
          <div style={{fontWeight:800,fontSize:15,color:th.text,marginBottom:2}}>📊 Spending Breakdown</div>
          <div style={{fontSize:13,color:th.sub,marginBottom:12}}>{MONTHS[m]} {y}</div>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={catData.map(c=>({name:c.label,value:c.val}))} cx="50%" cy="50%" innerRadius={46} outerRadius={74} dataKey="value" paddingAngle={3}>
                {catData.map((c,i)=><Cell key={i} fill={c.color}/>)}
              </Pie>
              <Tooltip formatter={v=>fmt(v)} contentStyle={{background:th.card,border:`1px solid ${th.border}`,borderRadius:10,color:th.text,fontSize:13}}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:"flex",flexWrap:"wrap",gap:"6px 14px",marginTop:4}}>
            {catData.slice(0,8).map(c=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:th.sub}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                {c.icon} {c.label}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent transactions */}
      <Card th={th}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontWeight:800,fontSize:15,color:th.text}}>🕐 Recent Transactions</div>
          <button onClick={()=>onNav("expenses")} style={{background:"none",border:"none",color:th.accent,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>See all →</button>
        </div>
        {recent.length===0
          ? <p style={{color:th.sub,textAlign:"center",padding:"24px 0"}}>No transactions yet. Tap + to add one!</p>
          : recent.map((e,i)=>{
              const c = getcat(e.category);
              return (
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:i<recent.length-1?`1px solid ${th.border}`:"none"}}>
                  <div style={{width:40,height:40,borderRadius:12,background:`${c.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{c.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:th.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.note||c.label}</div>
                    <div style={{fontSize:12,color:th.sub}}>{e.date} · {c.label}</div>
                  </div>
                  <div style={{fontWeight:800,fontSize:15,color:e.type==="credit"?"#00d4aa":"#ff4d6d",whiteSpace:"nowrap"}}>
                    {e.type==="credit"?"+":"−"}{fmt(e.amount)}
                  </div>
                </div>
              );
            })
        }
      </Card>
    </div>
  );
}

// ── EXPENSES PAGE ─────────────────────────────────────────────────────────────
function ExpensesPage({expenses, onDelete, onEdit, th}) {
  const now = new Date();
  const [filter,setFilter] = useState("all");
  const [search,setSearch] = useState("");
  const [selM,setSelM]     = useState(now.getMonth());
  const [selY,setSelY]     = useState(now.getFullYear());

  const rows = useMemo(()=>
    expenses.filter(e=>{
      const d = new Date(e.date);
      return d.getMonth()===selM && d.getFullYear()===selY
        && (filter==="all"||e.type===filter)
        && (!search || e.note?.toLowerCase().includes(search.toLowerCase())
          || getcat(e.category).label.toLowerCase().includes(search.toLowerCase()));
    }).sort((a,b)=>b.date.localeCompare(a.date))
  ,[expenses,filter,search,selM,selY]);

  const debit  = rows.filter(e=>e.type==="debit" ).reduce((s,e)=>s+e.amount,0);
  const credit = rows.filter(e=>e.type==="credit").reduce((s,e)=>s+e.amount,0);

  // Group by date
  const grouped = {};
  rows.forEach(e=>{ grouped[e.date]=(grouped[e.date]||[]).concat(e); });
  const dates = Object.keys(grouped).sort().reverse();

  return (
    <div>
      <h2 style={{margin:"0 0 20px",color:th.text,fontSize:22,fontWeight:900}}>Transactions</h2>

      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <select value={selM} onChange={e=>setSelM(+e.target.value)}
          style={{flex:2,padding:"10px 12px",borderRadius:12,background:th.input,border:`1.5px solid ${th.border}`,color:th.text,fontSize:14,fontFamily:"inherit",outline:"none"}}>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
        <select value={selY} onChange={e=>setSelY(+e.target.value)}
          style={{flex:1,padding:"10px 12px",borderRadius:12,background:th.input,border:`1.5px solid ${th.border}`,color:th.text,fontSize:14,fontFamily:"inherit",outline:"none"}}>
          {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={{display:"flex",gap:7,marginBottom:12}}>
        {["all","debit","credit"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            flex:1,padding:"9px",borderRadius:11,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit",transition:"all .2s",
            background:filter===f?(f==="debit"?"#ff4d6d":f==="credit"?"#00d4aa":"#7c5cfc"):th.input,
            color:filter===f?"#fff":th.sub
          }}>{f==="all"?"All":f==="debit"?"💸 Expense":"💰 Income"}</button>
        ))}
      </div>

      <div style={{position:"relative",marginBottom:14}}>
        <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:th.sub,fontSize:15,pointerEvents:"none"}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search transactions..."
          style={{width:"100%",boxSizing:"border-box",padding:"11px 14px 11px 40px",borderRadius:12,background:th.input,border:`1.5px solid ${th.border}`,color:th.text,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
      </div>

      {/* Totals */}
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <div style={{flex:1,padding:"10px 14px",borderRadius:13,background:"#ff4d6d18",border:"1px solid #ff4d6d28"}}>
          <div style={{fontSize:11,color:th.sub,fontWeight:700}}>SPENT</div>
          <div style={{fontSize:18,fontWeight:900,color:"#ff4d6d"}}>{fmt(debit)}</div>
        </div>
        <div style={{flex:1,padding:"10px 14px",borderRadius:13,background:"#00d4aa18",border:"1px solid #00d4aa28"}}>
          <div style={{fontSize:11,color:th.sub,fontWeight:700}}>INCOME</div>
          <div style={{fontSize:18,fontWeight:900,color:"#00d4aa"}}>{fmt(credit)}</div>
        </div>
      </div>

      {dates.length===0
        ? <Card th={th}><p style={{color:th.sub,textAlign:"center",padding:"28px 0"}}>No transactions found.</p></Card>
        : dates.map(date=>(
          <div key={date} style={{marginBottom:8}}>
            <div style={{fontSize:11,color:th.sub,fontWeight:700,padding:"6px 4px 4px",textTransform:"uppercase",letterSpacing:".5px"}}>{date}</div>
            <Card th={th} style={{padding:"4px 16px"}}>
              {grouped[date].map((e,i)=>{
                const c = getcat(e.category);
                return (
                  <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:i<grouped[date].length-1?`1px solid ${th.border}`:"none"}}>
                    <div style={{width:40,height:40,borderRadius:12,background:`${c.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{c.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:14,color:th.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.note||c.label}</div>
                      <div style={{fontSize:11,color:th.sub}}>{c.label}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontWeight:800,fontSize:15,color:e.type==="credit"?"#00d4aa":"#ff4d6d"}}>{e.type==="credit"?"+":"−"}{fmt(e.amount)}</div>
                      <div style={{display:"flex",gap:4,justifyContent:"flex-end",marginTop:4}}>
                        <button onClick={()=>onEdit(e)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,padding:"1px 4px",color:th.sub}}>✏</button>
                        <button onClick={()=>onDelete(e.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,padding:"1px 4px",color:th.sub}}>🗑</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        ))
      }
    </div>
  );
}

// ── ANALYTICS PAGE ────────────────────────────────────────────────────────────
function AnalyticsPage({expenses, budget, th, me}) {
  const now = new Date();
  const [view,setView] = useState("monthly");
  const [selM,setSelM] = useState(now.getMonth());
  const [selY,setSelY] = useState(now.getFullYear());

  const thisM  = expenses.filter(e=>{ const d=new Date(e.date); return d.getMonth()===selM&&d.getFullYear()===selY; });
  const debit  = thisM.filter(e=>e.type==="debit" ).reduce((s,e)=>s+e.amount,0);
  const credit = thisM.filter(e=>e.type==="credit").reduce((s,e)=>s+e.amount,0);

  const trend = Array.from({length:6},(_,i)=>{
    const d=new Date(selY,selM-5+i,1); const mm=d.getMonth(); const yy=d.getFullYear();
    const db=expenses.filter(e=>{ const ed=new Date(e.date); return ed.getMonth()===mm&&ed.getFullYear()===yy&&e.type==="debit"; }).reduce((s,e)=>s+e.amount,0);
    const cr=expenses.filter(e=>{ const ed=new Date(e.date); return ed.getMonth()===mm&&ed.getFullYear()===yy&&e.type==="credit"; }).reduce((s,e)=>s+e.amount,0);
    return {name:MONTHS[mm],Expense:db,Income:cr};
  });

  const weeks = Array.from({length:4},(_,w)=>({
    name:`Wk ${w+1}`,
    Spent:thisM.filter(e=>{ const day=new Date(e.date).getDate(); return day>=w*7+1&&day<=(w+1)*7&&e.type==="debit"; }).reduce((s,e)=>s+e.amount,0)
  }));

  const catData = CATS.filter(c=>c.id!=="salary")
    .map(c=>({...c,val:thisM.filter(e=>e.category===c.id&&e.type==="debit").reduce((s,e)=>s+e.amount,0)}))
    .filter(c=>c.val>0).sort((a,b)=>b.val-a.val);

  const ttFmt = v=>v>=1000?`₹${(v/1000).toFixed(1)}k`:`₹${v}`;
  const tStyle= {background:th.card,border:`1px solid ${th.border}`,borderRadius:10,color:th.text,fontSize:13};

  const doPrint = () => {
    const rows=expenses.filter(e=>{const d=new Date(e.date);return d.getMonth()===selM&&d.getFullYear()===selY;}).sort((a,b)=>b.date.localeCompare(a.date));
    const db=rows.filter(e=>e.type==="debit").reduce((s,e)=>s+e.amount,0);
    const cr=rows.filter(e=>e.type==="credit").reduce((s,e)=>s+e.amount,0);
    const w=window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>XpenseUp ${FMONTHS[selM]} ${selY}</title>
    <style>body{font-family:system-ui,sans-serif;padding:32px;color:#1a0a2e}h1{color:#6c3fff;font-size:28px;margin-bottom:4px}.sub{color:#6b5a8a;margin-bottom:28px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}.card{padding:16px;border-radius:12px;background:#f5f3ff;border:1px solid #ddd6ff}.card h3{margin:0;font-size:11px;color:#6b5a8a;text-transform:uppercase;font-weight:700}.card p{margin:6px 0 0;font-size:22px;font-weight:800}table{width:100%;border-collapse:collapse}th{background:#f5f3ff;color:#6c3fff;padding:10px 12px;text-align:left;font-size:12px;font-weight:700;text-transform:uppercase}td{padding:10px 12px;border-bottom:1px solid #f0ebff}.cr{color:#00b894;font-weight:700}.db{color:#e74c3c;font-weight:700}.footer{margin-top:28px;color:#9b8fc4;font-size:12px;text-align:center}</style>
    </head><body><h1>💸 XpenseUp</h1><p class="sub">${me.name} — ${FMONTHS[selM]} ${selY} Report</p>
    <div class="cards"><div class="card"><h3>Income</h3><p class="cr">${fmt(cr)}</p></div><div class="card"><h3>Expenses</h3><p class="db">${fmt(db)}</p></div><div class="card"><h3>Net Saved</h3><p style="color:#6c3fff">${fmt(cr-db)}</p></div><div class="card"><h3>Budget</h3><p style="color:#6c3fff">${fmt(budget||0)}</p></div></div>
    <table><thead><tr><th>#</th><th>Date</th><th>Category</th><th>Note</th><th>Type</th><th style="text-align:right">Amount</th></tr></thead><tbody>
    ${rows.map((e,i)=>{const c=getcat(e.category);return`<tr><td style="color:#9b8fc4">${i+1}</td><td>${e.date}</td><td>${c.icon} ${c.label}</td><td>${e.note||"—"}</td><td class="${e.type==="credit"?"cr":"db"}">${e.type==="credit"?"+ Income":"− Expense"}</td><td style="text-align:right" class="${e.type==="credit"?"cr":"db"}">${fmt(e.amount)}</td></tr>`;}).join("")}
    </tbody></table><div class="footer">XpenseUp • Generated ${new Date().toLocaleString("en-IN")}</div>
    <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{margin:0,color:th.text,fontSize:22,fontWeight:900}}>Analytics</h2>
        <Btn onClick={doPrint} color="#7c5cfc" sm>🖨 Print</Btn>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <select value={selM} onChange={e=>setSelM(+e.target.value)}
          style={{flex:2,padding:"10px",borderRadius:12,background:th.input,border:`1.5px solid ${th.border}`,color:th.text,fontSize:14,fontFamily:"inherit",outline:"none"}}>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
        <select value={selY} onChange={e=>setSelY(+e.target.value)}
          style={{flex:1,padding:"10px",borderRadius:12,background:th.input,border:`1.5px solid ${th.border}`,color:th.text,fontSize:14,fontFamily:"inherit",outline:"none"}}>
          {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={{display:"flex",gap:7,marginBottom:20}}>
        {["monthly","weekly","categories"].map(v=>(
          <button key={v} onClick={()=>setView(v)} style={{
            flex:1,padding:"10px",borderRadius:12,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",
            background:view===v?"#7c5cfc":th.input,color:view===v?"#fff":th.sub,transition:"all .2s"
          }}>{v==="monthly"?"📅 Monthly":v==="weekly"?"📆 Weekly":"🍕 Categories"}</button>
        ))}
      </div>

      {/* Monthly */}
      {view==="monthly" && <>
        <Card th={th} style={{marginBottom:18}}>
          <div style={{fontWeight:800,fontSize:15,color:th.text,marginBottom:2}}>6-Month Trend</div>
          <div style={{fontSize:13,color:th.sub,marginBottom:16}}>Income vs Expenses</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff4d6d" stopOpacity={0.35}/><stop offset="95%" stopColor="#ff4d6d" stopOpacity={0}/></linearGradient>
                <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00d4aa" stopOpacity={0.35}/><stop offset="95%" stopColor="#00d4aa" stopOpacity={0}/></linearGradient>
              </defs>
              <XAxis dataKey="name" stroke={th.sub} tick={{fill:th.sub,fontSize:12}}/>
              <YAxis stroke={th.sub} tick={{fill:th.sub,fontSize:11}} tickFormatter={ttFmt}/>
              <Tooltip formatter={v=>fmt(v)} contentStyle={tStyle}/>
              <Legend/>
              <Area type="monotone" dataKey="Expense" stroke="#ff4d6d" fill="url(#gE)" strokeWidth={2.5}/>
              <Area type="monotone" dataKey="Income"  stroke="#00d4aa" fill="url(#gI)" strokeWidth={2.5}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:18}}>
          {[{l:"Spent",v:debit,c:"#ff4d6d"},{l:"Income",v:credit,c:"#00d4aa"},{l:"Saved",v:credit-debit,c:"#7c5cfc"}].map(x=>(
            <div key={x.l} style={{padding:"14px 12px",borderRadius:16,background:`${x.c}18`,border:`1px solid ${x.c}28`,textAlign:"center"}}>
              <div style={{fontSize:11,color:th.sub,fontWeight:700,textTransform:"uppercase"}}>{x.l}</div>
              <div style={{fontSize:16,fontWeight:900,color:x.c,marginTop:4}}>{fmt(x.v)}</div>
            </div>
          ))}
        </div>
        {budget>0 && <Card th={th}>
          <div style={{fontWeight:800,fontSize:15,color:th.text,marginBottom:2}}>Budget vs Actual</div>
          <div style={{fontSize:13,color:th.sub,marginBottom:14}}>{FMONTHS[selM]}</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={[{name:MONTHS[selM],Budget:budget,Actual:debit}]}>
              <XAxis dataKey="name" stroke={th.sub} tick={{fill:th.sub}}/>
              <YAxis stroke={th.sub} tick={{fill:th.sub,fontSize:11}} tickFormatter={ttFmt}/>
              <Tooltip formatter={v=>fmt(v)} contentStyle={tStyle}/>
              <Legend/>
              <Bar dataKey="Budget" fill="#7c5cfc55" radius={[8,8,0,0]}/>
              <Bar dataKey="Actual" fill="#ff4d6d"   radius={[8,8,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>}
      </>}

      {/* Weekly */}
      {view==="weekly" && <Card th={th}>
        <div style={{fontWeight:800,fontSize:15,color:th.text,marginBottom:2}}>Weekly Spending</div>
        <div style={{fontSize:13,color:th.sub,marginBottom:16}}>{FMONTHS[selM]} {selY}</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeks}>
            <XAxis dataKey="name" stroke={th.sub} tick={{fill:th.sub,fontSize:13}}/>
            <YAxis stroke={th.sub} tick={{fill:th.sub,fontSize:11}} tickFormatter={ttFmt}/>
            <Tooltip formatter={v=>fmt(v)} contentStyle={tStyle}/>
            <Bar dataKey="Spent" radius={[10,10,0,0]}>
              {weeks.map((_,i)=><Cell key={i} fill={["#7c5cfc","#ff6b9d","#00d4aa","#ffd60a"][i]}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>}

      {/* Categories */}
      {view==="categories" && <Card th={th}>
        <div style={{fontWeight:800,fontSize:15,color:th.text,marginBottom:2}}>Category Breakdown</div>
        <div style={{fontSize:13,color:th.sub,marginBottom:20}}>{FMONTHS[selM]} {selY}</div>
        {catData.length===0
          ? <p style={{color:th.sub,textAlign:"center",padding:"20px 0"}}>No expenses this month.</p>
          : catData.map(c=>{
              const pct = debit>0?(c.val/debit*100):0;
              return (
                <div key={c.id} style={{marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:14,color:th.text,fontWeight:600}}>{c.icon} {c.label}</span>
                    <span style={{fontSize:14,fontWeight:800,color:c.color}}>{fmt(c.val)} <span style={{color:th.sub,fontWeight:400,fontSize:12}}>({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div style={{height:9,borderRadius:99,background:th.border,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,borderRadius:99,background:c.color,transition:"width .5s"}}/>
                  </div>
                </div>
              );
            })
        }
      </Card>}
    </div>
  );
}

// ── GROUPS PAGE ───────────────────────────────────────────────────────────────
function GroupsPage({groups, users, me, th, onSettle, onAddExp}) {
  const [sel,setSel]     = useState(null);
  const [showAdd,setAdd] = useState(false);
  const [desc,setDesc]   = useState("");
  const [amt,setAmt]     = useState("");
  const [paidBy,setPaid] = useState(me.id);

  const myGroups = groups.filter(g=>g.members.includes(me.id));
  const group    = myGroups.find(g=>g.id===sel);

  const closeDetail = () => { setSel(null); setAdd(false); setDesc(""); setAmt(""); setPaid(me.id); };

  if(sel && group) {
    const mems    = users.filter(u=>group.members.includes(u.id));
    const perHead = mems.length&&amt ? (+amt/mems.length).toFixed(2) : 0;
    const total   = group.expenses.reduce((s,e)=>s+e.amount,0);
    const myOwed  = group.expenses.reduce((s,e)=>{const sp=e.splits?.find(sp=>sp.userId===me.id); return s+(sp&&!sp.settled&&e.paidBy!==me.id?sp.amount:0);},0);

    return (
      <div>
        <button onClick={closeDetail} style={{background:"none",border:"none",cursor:"pointer",color:th.accent,fontSize:15,fontWeight:700,padding:"0 0 20px",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>← All Groups</button>
        <Card th={th} glow="#7c5cfc" style={{marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
            <div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg,#7c5cfc,#ff6b9d)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>👥</div>
            <div style={{flex:1}}>
              <h3 style={{margin:0,color:th.text,fontSize:18,fontWeight:900}}>{group.name}</h3>
              <div style={{color:th.sub,fontSize:13,marginTop:2}}>{mems.length} members</div>
            </div>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
            {mems.map(m=>(
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:20,background:th.input,border:`1px solid ${th.border}`}}>
                <Avi user={m} size={22} th={th}/>
                <span style={{fontSize:13,color:th.text,fontWeight:600}}>{m.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:1,padding:"10px",borderRadius:12,background:"#7c5cfc18",textAlign:"center"}}>
              <div style={{fontSize:11,color:th.sub,fontWeight:700}}>TOTAL</div>
              <div style={{fontSize:17,fontWeight:900,color:"#7c5cfc"}}>{fmt(total)}</div>
            </div>
            {myOwed>0&&<div style={{flex:1,padding:"10px",borderRadius:12,background:"#ff4d6d18",textAlign:"center"}}>
              <div style={{fontSize:11,color:th.sub,fontWeight:700}}>YOU OWE</div>
              <div style={{fontSize:17,fontWeight:900,color:"#ff4d6d"}}>{fmt(myOwed)}</div>
            </div>}
          </div>
        </Card>

        {showAdd && (
          <Card th={th} style={{marginBottom:18}}>
            <div style={{fontWeight:800,fontSize:15,color:th.text,marginBottom:14}}>Add Group Expense</div>
            <Inp label="Description" value={desc} onChange={setDesc} icon="📝" placeholder="Dinner, Hotel..." th={th}/>
            <Inp label="Total Amount ₹" type="number" value={amt} onChange={setAmt} icon="₹" placeholder="0" th={th}/>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,color:th.sub,marginBottom:5,display:"block",fontWeight:700,textTransform:"uppercase",letterSpacing:".4px"}}>Paid by</label>
              <select value={paidBy} onChange={e=>setPaid(e.target.value)}
                style={{width:"100%",padding:"12px 14px",borderRadius:12,background:th.input,border:`2px solid ${th.border}`,color:th.text,fontSize:14,fontFamily:"inherit",outline:"none"}}>
                {mems.map(m=><option key={m.id} value={m.id}>{m.name}{m.id===me.id?" (You)":""}</option>)}
              </select>
            </div>
            {amt>0 && <div style={{padding:"10px 14px",borderRadius:12,background:"#00d4aa18",marginBottom:14,border:"1px solid #00d4aa44"}}>
              <p style={{margin:0,fontSize:14,color:"#00d4aa",fontWeight:700}}>Each pays: {fmt(perHead)} ({mems.length} people)</p>
            </div>}
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>{setAdd(false);setDesc("");setAmt("");}} outline color={th.sub} full>Cancel</Btn>
              <Btn onClick={async ()=>{
                if(!desc.trim()||!(+amt>0)) return;
                await onAddExp(group.id,{description:desc,amount:+amt,paidBy,memberIds:mems.map(m=>m.id)});
                setAdd(false);setDesc("");setAmt("");setPaid(me.id);
              }} color="#7c5cfc" full>Add Expense</Btn>
            </div>
          </Card>
        )}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontWeight:800,fontSize:15,color:th.text}}>Expenses ({group.expenses.length})</div>
          {!showAdd && <Btn onClick={()=>setAdd(true)} color="#7c5cfc" sm>+ Add</Btn>}
        </div>

        {group.expenses.length===0
          ? <Card th={th}><p style={{color:th.sub,textAlign:"center",padding:"24px 0"}}>No expenses yet.</p></Card>
          : group.expenses.map(exp=>{
              const payer = users.find(u=>u.id===exp.paidBy)||me;
              const allOk = exp.splits?.every(s=>s.settled);
              return (
                <Card key={exp.id} th={th} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div>
                      <div style={{fontWeight:800,color:th.text,fontSize:15}}>{exp.description}</div>
                      <div style={{fontSize:13,color:th.sub,marginTop:3}}>Paid by {payer.name} · {exp.date}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontWeight:900,fontSize:17,color:"#7c5cfc"}}>{fmt(exp.amount)}</div>
                      {allOk && <Pill color="#00d4aa">All settled ✅</Pill>}
                    </div>
                  </div>
                  {exp.splits?.map(sp=>{
                    const u=users.find(x=>x.id===sp.userId); if(!u) return null;
                    return (
                      <div key={sp.userId} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:`1px solid ${th.border}`}}>
                        <Avi user={u} size={28} th={th}/>
                        <span style={{flex:1,fontSize:13,color:th.text,fontWeight:600}}>{u.name}{u.id===me.id?" (You)":""}</span>
                        {sp.settled
                          ? <Pill color="#00d4aa">✅ Settled</Pill>
                          : <>
                              <Pill color="#ff4d6d">Owes {fmt(sp.amount)}</Pill>
                              {sp.userId===me.id && <Btn onClick={()=>onSettle(group.id,exp.id,sp.userId)} color="#00d4aa" sm>Settle</Btn>}
                            </>
                        }
                      </div>
                    );
                  })}
                </Card>
              );
            })
        }
      </div>
    );
  }

  return (
    <div>
      <h2 style={{margin:"0 0 20px",color:th.text,fontSize:22,fontWeight:900}}>Groups & Splits</h2>
      {myGroups.length===0
        ? <Card th={th} style={{textAlign:"center",padding:"48px 20px"}}>
            <div style={{fontSize:56,marginBottom:12}}>👥</div>
            <div style={{fontWeight:800,color:th.text,fontSize:17,marginBottom:8}}>No groups yet</div>
            <div style={{color:th.sub,fontSize:14,lineHeight:1.6}}>Tap 👥 button below to create a group<br/>and split expenses with friends!</div>
          </Card>
        : myGroups.map(g=>{
            const mems  = users.filter(u=>g.members.includes(u.id));
            const total = g.expenses.reduce((s,e)=>s+e.amount,0);
            const myOwed= g.expenses.reduce((s,e)=>{const sp=e.splits?.find(sp=>sp.userId===me.id);return s+(sp&&!sp.settled&&e.paidBy!==me.id?sp.amount:0);},0);
            const myLent= g.expenses.reduce((s,e)=>{const oth=e.splits?.filter(sp=>sp.userId!==me.id&&!sp.settled)||[];return s+(e.paidBy===me.id?oth.reduce((o,sp)=>o+sp.amount,0):0);},0);
            return (
              <Card key={g.id} th={th} style={{marginBottom:14,cursor:"pointer"}} onClick={()=>setSel(g.id)}>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#7c5cfc,#ff6b9d)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>👥</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,color:th.text,fontSize:15}}>{g.name}</div>
                    <div style={{fontSize:13,color:th.sub,marginTop:2}}>{mems.length} members · {g.expenses.length} expense{g.expenses.length!==1?"s":""}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:800,color:"#7c5cfc",fontSize:15}}>{fmt(total)}</div>
                    {myOwed>0 && <div style={{marginTop:3}}><Pill color="#ff4d6d">Owe {fmt(myOwed)}</Pill></div>}
                    {myLent>0 && <div style={{marginTop:3}}><Pill color="#00d4aa">Get {fmt(myLent)}</Pill></div>}
                  </div>
                </div>
              </Card>
            );
          })
      }
    </div>
  );
}

// ── SETTINGS PAGE ─────────────────────────────────────────────────────────────
function SettingsPage({me, budget, th, dark, toggleDark, onLogout, onSetBudget}) {
  const [bInput,setBInput] = useState(String(budget||""));
  const [saved,setSaved]   = useState(false);
  const [busy,setBusy]     = useState(false);
  const [err,setErr]       = useState("");
  const [confirm,setConfirm]= useState(false);

  const saveBudget = async () => {
    setBusy(true); setErr("");
    try {
      await onSetBudget(+bInput||0);
      setSaved(true); setTimeout(()=>setSaved(false),2000);
    } catch(e) {
      setErr(e.message || "Could not save. Check your connection.");
    } finally { setBusy(false); }
  };

  return (
    <div>
      <h2 style={{margin:"0 0 24px",color:th.text,fontSize:22,fontWeight:900}}>Settings</h2>

      {/* Profile */}
      <Card th={th} glow={me.color} style={{marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <Avi user={me} size={56} th={th}/>
          <div>
            <div style={{fontWeight:900,fontSize:18,color:th.text}}>{me.name}</div>
            <div style={{fontSize:13,color:th.sub,marginTop:2}}>{me.email}</div>
            <div style={{marginTop:6}}><Pill color={me.color}>Active Account</Pill></div>
          </div>
        </div>
      </Card>

      {/* Budget */}
      <Card th={th} style={{marginBottom:18}}>
        <div style={{fontWeight:800,fontSize:15,color:th.text,marginBottom:14}}>🎯 Monthly Budget</div>
        <Inp label="Budget Amount (₹)" type="number" value={bInput} onChange={setBInput} icon="₹" placeholder="e.g. 15000" th={th}/>
        {saved && <div style={{color:"#00d4aa",fontSize:14,marginBottom:10,fontWeight:700}}>✅ Budget saved!</div>}
        {err && <div style={{color:"#ff4d6d",fontSize:14,marginBottom:10}}>{err}</div>}
        <Btn onClick={saveBudget} color="#7c5cfc" full disabled={busy}>{busy?"Saving…":"Save Budget"}</Btn>
      </Card>

      {/* Theme */}
      <Card th={th} style={{marginBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:th.text}}>{dark?"🌙 Dark Mode":"☀ Light Mode"}</div>
            <div style={{fontSize:13,color:th.sub,marginTop:2}}>Toggle appearance</div>
          </div>
          <button onClick={toggleDark} style={{width:54,height:30,borderRadius:99,border:"none",cursor:"pointer",position:"relative",background:dark?"linear-gradient(90deg,#7c5cfc,#ff6b9d)":th.border,transition:"all .3s"}}>
            <div style={{position:"absolute",top:4,left:dark?28:4,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"left .3s",boxShadow:"0 2px 6px rgba(0,0,0,.25)"}}/>
          </button>
        </div>
      </Card>

      {/* Cloud sync */}
      <Card th={th} style={{marginBottom:18}}>
        <div style={{fontWeight:800,fontSize:15,color:th.text,marginBottom:6}}>☁ Cloud Sync</div>
        <div style={{fontSize:13,color:th.sub,lineHeight:1.7}}>
          Everything you add is saved to your account, not this browser. Sign in
          with <strong style={{color:th.text}}>{me.email}</strong> on a phone,
          laptop or tablet and the same data is there.
        </div>
        <div style={{marginTop:12,display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:12,background:"#00d4aa14",border:"1px solid #00d4aa33"}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:"#00d4aa",flexShrink:0}}/>
          <span style={{fontSize:13,color:"#00d4aa",fontWeight:700}}>Connected</span>
        </div>
      </Card>

      {/* Logout */}
      <Card th={th}>
        <div style={{fontWeight:800,fontSize:15,color:th.text,marginBottom:4}}>Sign Out</div>
        <div style={{fontSize:13,color:th.sub,marginBottom:14}}>Your data stays in your account and will be here when you sign back in.</div>
        {confirm
          ? <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>setConfirm(false)} outline color={th.sub} full>Cancel</Btn>
              <Btn onClick={onLogout} color="#ff4d6d" full>Yes, Sign Out</Btn>
            </div>
          : <Btn onClick={()=>setConfirm(true)} outline color="#ff4d6d" full>🚪 Sign Out</Btn>
        }
      </Card>
    </div>
  );
}

// ── SETUP / LOADING SCREENS ───────────────────────────────────────────────────
function Centered({th, children}) {
  return (
    <div style={{minHeight:"100vh",background:th.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"Inter,system-ui,sans-serif"}}>
      <div style={{width:"100%",maxWidth:460,textAlign:"center"}}>{children}</div>
    </div>
  );
}

function Splash({th}) {
  return (
    <Centered th={th}>
      <div style={{fontSize:54,marginBottom:12}}>💸</div>
      <div style={{fontWeight:900,fontSize:22,color:th.text,letterSpacing:-0.8}}>XpenseUp</div>
      <div style={{color:th.sub,fontSize:14,marginTop:8}}>Loading your data…</div>
    </Centered>
  );
}

// Shown when the two Supabase environment variables are missing, so a bad
// deploy explains itself instead of failing silently on first click.
function SetupNotice({th}) {
  return (
    <Centered th={th}>
      <Card th={th} glow="#ffd60a" style={{textAlign:"left"}}>
        <div style={{fontSize:40,marginBottom:10}}>⚙</div>
        <h2 style={{margin:"0 0 10px",fontSize:20,fontWeight:900,color:th.text}}>Cloud database not connected</h2>
        <p style={{color:th.sub,fontSize:14,lineHeight:1.7,margin:"0 0 14px"}}>
          Set these two environment variables, then redeploy:
        </p>
        <pre style={{background:th.input,border:`1px solid ${th.border}`,borderRadius:12,padding:14,fontSize:12.5,color:th.text,overflowX:"auto",margin:"0 0 14px"}}>
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...`}
        </pre>
        <p style={{color:th.sub,fontSize:13,lineHeight:1.7,margin:0}}>
          On Vercel: Project → Settings → Environment Variables. Locally: put
          them in <strong style={{color:th.text}}>.env.local</strong>. Full
          walkthrough is in <strong style={{color:th.text}}>README.md</strong>.
        </p>
      </Card>
    </Centered>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [dark,setDark]   = useState(() => localStorage.getItem("xpenseup_dark") !== "false");
  const [me,setMe]       = useState(null);
  const [budget,setBudgetState] = useState(0);
  const [expenses,setExpenses]  = useState([]);
  const [groups,setGroups]      = useState([]);
  const [booting,setBooting]    = useState(true);
  const [toast,setToast]        = useState("");
  const [page,setPage]   = useState("dashboard");
  const [showAdd,setAdd] = useState(false);
  const [showGrp,setGrp] = useState(false);
  const [editExp,setEdit]= useState(null);
  const [fabOpen,setFab] = useState(false);

  const th = THEMES[dark?"dark":"light"];

  useEffect(() => { localStorage.setItem("xpenseup_dark", String(dark)); }, [dark]);

  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4500);
  }, []);

  // ── LOADING ────────────────────────────────────────────────────────────────
  // Pull the whole account. On a first cloud sign-in, lift anything that was
  // sitting in this browser's old localStorage blob into the account.
  const loadAll = useCallback(async (profile) => {
    const [tx, grps] = await Promise.all([api.listTransactions(), api.listGroups()]);
    let list = tx;
    const imported = await api.importLocalDataOnce(profile, tx.length);
    if (imported > 0) {
      list = await api.listTransactions();
      notify(`☁ Imported ${imported} transaction${imported===1?"":"s"} from this browser.`);
    }
    setExpenses(list);
    setGroups(grps);
    setBudgetState(profile.budget);
  }, [notify]);

  const startSession = useCallback(async (authUser) => {
    const profile = await api.loadProfile(authUser);
    setMe(profile);
    setPage("dashboard");
    await loadAll(profile);
  }, [loadAll]);

  // Resume an existing session, so a refresh (or a new device) lands you
  // straight back in your dashboard.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isConfigured) { setBooting(false); return; }
      try {
        const authUser = await restoreSession();
        if (alive && authUser) await startSession(authUser);
      } catch (e) {
        if (alive) notify(e.message || "Could not reach the database.");
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => { alive = false; };
  }, [startSession, notify]);

  // ── AUTH ───────────────────────────────────────────────────────────────────
  const login = async (email, pass) => {
    const session = await signIn(email, pass);
    await startSession(session.user);
  };

  const register = async (name, email, pass) => {
    const res = await signUp(email, pass, { name: name.trim(), ...api.randomIdentity() });
    if (res.session) { await startSession(res.session.user); return {}; }
    return res;
  };

  const logout = async () => {
    await signOut();
    setMe(null); setExpenses([]); setGroups([]); setBudgetState(0);
    setPage("dashboard");
  };

  // ── WRITES ─────────────────────────────────────────────────────────────────
  // Each write goes to the database first, then the local copy is updated from
  // what came back. If the request fails we re-read rather than leave the UI
  // showing something the server never accepted.
  const refreshTx     = async () => setExpenses(await api.listTransactions());
  const refreshGroups = async () => setGroups(await api.listGroups());

  const guard = (fn, recover) => async (...args) => {
    try { await fn(...args); }
    catch (e) {
      notify(e.message || "Something went wrong. Please try again.");
      try { if (recover) await recover(); } catch { /* offline */ }
    }
  };

  // Kept newest-first, matching the order the database returns, so back-dating
  // a transaction still drops it in the right place.
  const byDateDesc = (a, b) => String(b.date).localeCompare(String(a.date));

  const addExp = guard(async (exp) => {
    const saved = await api.addTransaction(exp);
    setExpenses(list => [saved, ...list].sort(byDateDesc));
  }, refreshTx);

  const saveExp = guard(async (exp) => {
    const saved = await api.updateTransaction(exp);
    setExpenses(list => list.map(e => e.id === saved.id ? saved : e).sort(byDateDesc));
  }, refreshTx);

  const delExp = guard(async (id) => {
    await api.deleteTransaction(id);
    setExpenses(list => list.filter(e => e.id !== id));
  }, refreshTx);

  // Surfaced through SettingsPage, which shows its own error, so this one
  // throws instead of swallowing.
  const setBudget = async (b) => { await api.setBudget(b); setBudgetState(Number(b) || 0); };

  const addGrp = async (g) => { await api.createGroup(g); await refreshGroups(); };

  const addGrpExp = guard(async (gid, exp) => {
    await api.addGroupExpense(gid, exp);
    await refreshGroups();
  }, refreshGroups);

  // GroupsPage still passes the group id first; the split is keyed by the
  // expense, so it is not needed here.
  const settle = guard(async (_groupId, expenseId, userId) => {
    await api.settleSplit(expenseId, userId);
    setGroups(gs => gs.map(g => ({
      ...g,
      expenses: g.expenses.map(e => e.id !== expenseId ? e : {
        ...e,
        splits: e.splits.map(s => s.userId === userId ? {...s, settled:true} : s),
      }),
    })));
  }, refreshGroups);

  // Everyone whose name/avatar this account is allowed to render: yourself,
  // plus the members of every group you are in.
  const people = useMemo(() => {
    const seen = new Map();
    if (me) seen.set(me.id, me);
    groups.forEach(g => (g.memberProfiles || []).forEach(p => {
      if (!seen.has(p.id)) seen.set(p.id, p);
    }));
    return Array.from(seen.values());
  }, [me, groups]);

  const NAV = [
    {id:"dashboard",icon:"🏠",label:"Home"},
    {id:"expenses", icon:"📋",label:"Expenses"},
    {id:"analytics",icon:"📊",label:"Charts"},
    {id:"groups",   icon:"👥",label:"Groups"},
    {id:"settings", icon:"🔧",label:"Settings"},
  ];

  if(!isConfigured) return <SetupNotice th={th}/>;
  if(booting)       return <Splash th={th}/>;
  if(!me)           return <AuthPage onLogin={login} onRegister={register} th={th}/>;

  return (
    <div style={{minHeight:"100vh",background:th.bg,fontFamily:"Inter,system-ui,sans-serif",color:th.text}}>
      {/* Ambient glows */}
      <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
        <div style={{position:"absolute",top:-150,right:-100,width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,#7c5cfc12,transparent 70%)"}}/>
        <div style={{position:"absolute",bottom:-100,left:-80,width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,#ff6b9d12,transparent 70%)"}}/>
      </div>

      {/* Header */}
      <div style={{position:"fixed",top:0,left:0,right:0,height:58,background:th.nav,borderBottom:`1px solid ${th.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",zIndex:100,backdropFilter:"blur(12px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:24,filter:"drop-shadow(0 2px 8px #7c5cfcaa)"}}>💸</span>
          <span style={{fontWeight:900,fontSize:18,color:th.text,letterSpacing:-0.5}}>XpenseUp</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setDark(d=>!d)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18}}>{dark?"🌙":"☀"}</button>
          <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setPage("settings")}>
            <Avi user={me} size={32} th={th}/>
            <span style={{fontSize:13,fontWeight:700,color:th.text}}>{me.name.split(" ")[0]}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{paddingTop:74,paddingBottom:90,maxWidth:520,margin:"0 auto",paddingLeft:16,paddingRight:16,position:"relative",zIndex:1}}>
        {page === "dashboard" && <Dashboard expenses={expenses} budget={budget} groups={groups} me={me} th={th} onNav={setPage}/>}
        {page === "expenses"  && <ExpensesPage expenses={expenses} onDelete={delExp} onEdit={e=>{setEdit(e);setAdd(true);}} th={th}/>}
        {page === "analytics" && <AnalyticsPage expenses={expenses} budget={budget} th={th} me={me}/>}
        {page === "groups"    && <GroupsPage groups={groups} users={people} me={me} th={th} onSettle={settle} onAddExp={addGrpExp}/>}
        {page === "settings"  && <SettingsPage me={me} budget={budget} th={th} dark={dark} toggleDark={()=>setDark(d=>!d)} onLogout={logout} onSetBudget={setBudget}/>}
      </div>

      {/* Floating Action Button */}
      <div style={{position:"fixed",bottom:80,right:20,zIndex:99,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10}}>
        {fabOpen && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10,marginBottom:6}}>
            <button onClick={()=>{setGrp(true);setFab(false);}} style={{
              display:"flex",alignItems:"center",gap:8,padding:"10px 16px",borderRadius:24,background:th.card,border:`1px solid ${th.border}`,color:th.text,fontWeight:700,fontSize:13,cursor:"pointer",boxShadow:"0 4px 16px rgba(0,0,0,0.3)",fontFamily:"inherit"
            }}>👥 New Group</button>
            <button onClick={()=>{setEdit(null);setAdd(true);setFab(false);}} style={{
              display:"flex",alignItems:"center",gap:8,padding:"10px 16px",borderRadius:24,background:"linear-gradient(135deg,#7c5cfc,#ff6b9d)",border:"none",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",boxShadow:"0 4px 16px rgba(124,92,252,0.4)",fontFamily:"inherit"
            }}>➕ Add Transaction</button>
          </div>
        )}
        <button onClick={()=>setFab(f=>!f)} style={{
          width:54,height:54,borderRadius:"50%",background:"linear-gradient(135deg,#7c5cfc,#ff6b9d)",border:"none",color:"#fff",fontSize:24,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 20px rgba(124,92,252,0.5)",transition:"transform .2s",transform:fabOpen?"rotate(45deg)":"none"
        }}>+</button>
      </div>

      {/* Bottom Navigation */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,height:64,background:th.nav,borderTop:`1px solid ${th.border}`,display:"flex",alignItems:"center",justifyContent:"space-around",zIndex:100,backdropFilter:"blur(12px)"}}>
        {NAV.map(n => {
          const act = page === n.id;
          return (
            <button key={n.id} onClick={()=>setPage(n.id)} style={{
              background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"6px 12px",borderRadius:12,transition:"all .2s",fontFamily:"inherit",
              color: act ? th.accent : th.sub
            }}>
              <span style={{fontSize:20,transform:act?"scale(1.15)":"scale(1)",transition:"transform .2s"}}>{n.icon}</span>
              <span style={{fontSize:11,fontWeight:act?800:600}}>{n.label}</span>
            </button>
          );
        })}
      </div>

      {/* Modals */}
      {showAdd && <ExpenseModal onClose={()=>{setAdd(false);setEdit(null);}} onSave={editExp?saveExp:addExp} th={th} initial={editExp}/>}
      {showGrp && <GroupModal onClose={()=>setGrp(false)} onSave={addGrp} th={th} me={me} onFindUser={api.findUserByEmail}/>}

      {/* Toast — sync notices and any write that failed */}
      {toast && (
        <div style={{position:"fixed",bottom:150,left:16,right:16,maxWidth:488,margin:"0 auto",zIndex:200,
          background:th.card,border:`1px solid ${th.border}`,borderLeft:`3px solid ${th.accent}`,
          borderRadius:12,padding:"12px 14px",fontSize:13,fontWeight:600,color:th.text,
          boxShadow:"0 8px 28px rgba(0,0,0,0.35)"}}>
          {toast}
        </div>
      )}
    </div>
  );
}
