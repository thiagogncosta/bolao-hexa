import { useState, useEffect, useRef } from "react";
import { db, ensureAuth } from "./firebase.js";
import {
  doc, getDoc, setDoc, collection, onSnapshot, serverTimestamp,
  getDocs
} from "firebase/firestore";

// ─── DADOS OFICIAIS ──────────────────────────────────────────────────────────
const GROUPS = [
  { id:"A", teams:["México","África do Sul","Coreia do Sul","Rep. Tcheca"] },
  { id:"B", teams:["Canadá","Bósnia e Herz.","Catar","Suíça"] },
  { id:"C", teams:["Brasil","Marrocos","Haiti","Escócia"] },
  { id:"D", teams:["Estados Unidos","Paraguai","Austrália","Turquia"] },
  { id:"E", teams:["Alemanha","Curaçao","Costa do Marfim","Equador"] },
  { id:"F", teams:["Holanda","Japão","Suécia","Tunísia"] },
  { id:"G", teams:["Bélgica","Egito","Irã","Nova Zelândia"] },
  { id:"H", teams:["Espanha","Cabo Verde","Arábia Saudita","Uruguai"] },
  { id:"I", teams:["França","Senegal","Iraque","Noruega"] },
  { id:"J", teams:["Argentina","Argélia","Áustria","Jordânia"] },
  { id:"K", teams:["Portugal","RD Congo","Uzbequistão","Colômbia"] },
  { id:"L", teams:["Inglaterra","Croácia","Gana","Panamá"] },
];

const BRAZIL_GAMES = [
  { id:"br1", label:"Jogo 1", date:"13/06", opponent:"Marrocos", home:true },
  { id:"br2", label:"Jogo 2", date:"19/06", opponent:"Haiti",    home:false },
  { id:"br3", label:"Jogo 3", date:"24/06", opponent:"Escócia",  home:true },
];

const ALL_TEAMS = GROUPS.flatMap(g => g.teams);

const KO_ROUNDS = [
  { id:"r32",   label:"Rodada de 32", short:"R32", points:5,  slots:32 },
  { id:"r16",   label:"Oitavas",      short:"R16", points:10, slots:16 },
  { id:"qf",    label:"Quartas",      short:"QF",  points:15, slots:8  },
  { id:"sf",    label:"Semifinais",   short:"SF",  points:20, slots:4  },
  { id:"final", label:"Final",        short:"FIN", points:60, slots:2  },
];

const COLORS = {
  "Brasil":"#009c3b","Marrocos":"#c1272d","Haiti":"#00209f","Escócia":"#003087",
  "México":"#006847","África do Sul":"#007a4d","Coreia do Sul":"#c60c30","Rep. Tcheca":"#d7141a",
  "Canadá":"#cc0000","Bósnia e Herz.":"#002395","Catar":"#8d1b3d","Suíça":"#e00016",
  "Estados Unidos":"#3c3b6e","Paraguai":"#0038a8","Austrália":"#00008b","Turquia":"#e30a17",
  "Alemanha":"#333333","Curaçao":"#002b7f","Costa do Marfim":"#f77f00","Equador":"#ffd100",
  "Holanda":"#ff6600","Japão":"#bc002d","Suécia":"#006aa7","Tunísia":"#e70013",
  "Bélgica":"#1a1a1a","Egito":"#c8102e","Irã":"#239f40","Nova Zelândia":"#00247d",
  "Espanha":"#aa151b","Cabo Verde":"#003893","Arábia Saudita":"#006c35","Uruguai":"#5aafd9",
  "França":"#002395","Senegal":"#00853f","Iraque":"#007a3d","Noruega":"#ef2b2d",
  "Argentina":"#74acdf","Argélia":"#006233","Áustria":"#ed2939","Jordânia":"#007a3d",
  "Portugal":"#006600","RD Congo":"#007fff","Uzbequistão":"#1eb53a","Colômbia":"#fcd116",
  "Inglaterra":"#cf142b","Croácia":"#cc0000","Gana":"#006b3f","Panamá":"#da121a",
};

const FLAGS = {
  "Brasil":"🇧🇷","Marrocos":"🇲🇦","Haiti":"🇭🇹","Escócia":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","México":"🇲🇽",
  "África do Sul":"🇿🇦","Coreia do Sul":"🇰🇷","Rep. Tcheca":"🇨🇿","Canadá":"🇨🇦",
  "Bósnia e Herz.":"🇧🇦","Catar":"🇶🇦","Suíça":"🇨🇭","Estados Unidos":"🇺🇸",
  "Paraguai":"🇵🇾","Austrália":"🇦🇺","Turquia":"🇹🇷","Alemanha":"🇩🇪","Curaçao":"🇨🇼",
  "Costa do Marfim":"🇨🇮","Equador":"🇪🇨","Holanda":"🇳🇱","Japão":"🇯🇵","Suécia":"🇸🇪",
  "Tunísia":"🇹🇳","Bélgica":"🇧🇪","Egito":"🇪🇬","Irã":"🇮🇷","Nova Zelândia":"🇳🇿",
  "Espanha":"🇪🇸","Cabo Verde":"🇨🇻","Arábia Saudita":"🇸🇦","Uruguai":"🇺🇾",
  "França":"🇫🇷","Senegal":"🇸🇳","Iraque":"🇮🇶","Noruega":"🇳🇴","Argentina":"🇦🇷",
  "Argélia":"🇩🇿","Áustria":"🇦🇹","Jordânia":"🇯🇴","Portugal":"🇵🇹","RD Congo":"🇨🇩",
  "Uzbequistão":"🇺🇿","Colômbia":"🇨🇴","Inglaterra":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Croácia":"🇭🇷","Gana":"🇬🇭","Panamá":"🇵🇦",
};

const ADMIN_CODE = "copa2026admin";

// ─── SCORING ─────────────────────────────────────────────────────────────────
function calcBrazilPts(guess, result) {
  if (!result || result.homeGoals==="" || result.homeGoals===undefined) return null;
  const gH=parseInt(guess.homeGoals), gA=parseInt(guess.awayGoals);
  const rH=parseInt(result.homeGoals), rA=parseInt(result.awayGoals);
  if (isNaN(gH)||isNaN(gA)) return null;
  if (gH===rH && gA===rA) return 20;
  const gD=gH-gA, rD=rH-rA;
  if (Math.sign(gD)===Math.sign(rD) && gD===rD) return 10;
  if (Math.sign(gD)===Math.sign(rD)) return 5;
  return 0;
}
function calcGroupPts(guess, result) {
  if (!result||!result.first) return null;
  let p=0;
  if (guess.first===result.first) p+=5; else if (guess.first===result.second) p+=2;
  if (guess.second===result.second) p+=5; else if (guess.second===result.first) p+=2;
  return p;
}
function calcKOPts(guesses={}, results={}) {
  let p=0;
  KO_ROUNDS.forEach(r=>{
    const gs=guesses[r.id]||[], rs=results[r.id]||[];
    rs.forEach((t,i)=>{ if(t&&gs[i]===t) p+=r.points; });
  });
  return p;
}
function calcTotal(p, adminResults) {
  if (!p) return 0;
  let t=0;
  BRAZIL_GAMES.forEach(g=>{ const x=calcBrazilPts(p.brazil?.[g.id]||{},adminResults.brazil?.[g.id]); if(x!=null) t+=x; });
  GROUPS.forEach(g=>{ const x=calcGroupPts(p.groups?.[g.id]||{},adminResults.groups?.[g.id]); if(x!=null) t+=x; });
  t+=calcKOPts(p.knockout,adminResults.knockout);
  return t;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function Flag({ team, size=24 }) {
  const bg=COLORS[team]||"#888", em=FLAGS[team]||"🏳";
  return <span style={{ width:size,height:size,borderRadius:"50%",background:bg,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:size*0.5,flexShrink:0,border:"1.5px solid rgba(0,0,0,0.1)" }}>{em}</span>;
}
function PtsBadge({ pts, max }) {
  if (pts===null) return <span style={{ fontSize:12,color:"var(--color-text-tertiary)" }}>—</span>;
  const bg=pts===max?"var(--color-background-success)":pts>0?"var(--color-background-warning)":"var(--color-background-secondary)";
  const cl=pts===max?"var(--color-text-success)":pts>0?"var(--color-text-warning)":"var(--color-text-tertiary)";
  return <span style={{ background:bg,color:cl,padding:"2px 8px",borderRadius:"var(--border-radius-md)",fontSize:12,fontWeight:500 }}>+{pts}pts</span>;
}
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display:"flex",borderBottom:"0.5px solid var(--color-border-tertiary)",marginBottom:16 }}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>onChange(t.id)} style={{
          background:"none",border:"none",cursor:"pointer",padding:"9px 16px",
          borderBottom:active===t.id?"2px solid var(--color-text-primary)":"2px solid transparent",
          fontWeight:active===t.id?500:400,fontSize:13,
          color:active===t.id?"var(--color-text-primary)":"var(--color-text-secondary)",
          borderRadius:0,marginBottom:-1,whiteSpace:"nowrap"
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
// Name is normalized to lowercase+trimmed and used as the Firestore document ID.
// This means any device can access the same profile by typing the same name.
function nameToId(name) {
  return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
}

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [currentId, setCurrentId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [participants, setParticipants] = useState({});
  const [adminResults, setAdminResults] = useState({ brazil:{}, groups:{}, knockout:{}, knockoutUnlocked:false, guessesLocked:false, guessesVisible:false });
  const [adminCode, setAdminCode] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [viewingUid, setViewingUid] = useState(null);
  const unsubRef = useRef(null);

  useEffect(() => {
    // Start subscriptions immediately — reads are public
    const unsubAdmin = onSnapshot(doc(db, "admin", "results"), snap => {
      if (snap.exists()) setAdminResults(snap.data());
    });
    const unsubParts = onSnapshot(collection(db, "participants"), snap => {
      const data = {};
      snap.forEach(d => { data[d.id] = d.data(); });
      setParticipants(data);
    });
    unsubRef.current = () => { unsubAdmin(); unsubParts(); };

    // Auth + session restore in background
    ensureAuth().then(() => {
      const savedId = localStorage.getItem("bolao_user_id");
      if (savedId) {
        getDoc(doc(db, "participants", savedId)).then(snap => {
          if (snap.exists()) {
            setCurrentId(savedId);
            setCurrentUser(snap.data());
            setScreen("home");
          } else {
            localStorage.removeItem("bolao_user_id");
            setScreen("register");
          }
        });
      } else {
        setScreen("register");
      }
    }).catch(() => setScreen("register"));

    return () => unsubRef.current?.();
  }, []);

  // ── Enter by name + PIN
  async function handleRegister() {
    const name = nameInput.trim(); if (!name) return;
    const pin = pinInput.trim(); if (!pin) { setLoginError("Digite seu PIN"); return; }
    setLoginError("");

    // Fetch all participants and find by name (client-side, avoids index requirement)
    const snap = await getDocs(collection(db, "participants"));
    let found = null;
    snap.forEach(d => {
      const data = d.data();
      // Case-insensitive name match
      if (data.name && data.name.trim().toLowerCase() === name.toLowerCase()) {
        found = { docId: d.id, data };
      }
    });

    if (found) {
      // Validate PIN
      if (String(found.data.pin) !== String(pin)) {
        setLoginError("PIN incorreto. Tente novamente.");
        return;
      }
      setCurrentId(found.docId);
      setCurrentUser(found.data);
      localStorage.setItem("bolao_user_id", found.docId);
      setScreen("home");
    } else {
      // New participant
      if (adminResults.guessesLocked) { setLoginError("Palpites encerrados, não é possível criar novo acesso."); return; }
      const newId = name.toLowerCase().replace(/\s+/g,"_") + "_" + Date.now();
      const data = { id:newId, name, pin:String(pin), brazil:{}, groups:{}, knockout:{}, createdAt:serverTimestamp() };
      await setDoc(doc(db,"participants",newId), data);
      setCurrentId(newId);
      setCurrentUser(data);
      localStorage.setItem("bolao_user_id", newId);
      setScreen("home");
    }
  }

  // ── Save participant guesses
  async function saveGuesses(updated) {
    setSaveStatus("saving");
    // Rebuild the ENTIRE document cleanly from currentUser identity + new guesses
    // This avoids any merge with corrupted/stale nested data
    const cleanDoc = {
      id: currentUser?.id || currentId,
      name: currentUser?.name || "",
      pin: currentUser?.pin != null ? String(currentUser.pin) : "",
      createdAt: currentUser?.createdAt || serverTimestamp(),
      brazil: updated.brazil || {},
      groups: updated.groups || {},
      knockout: updated.knockout || {},
    };
    // setDoc WITHOUT merge — completely overwrites, guaranteeing clean structure
    await setDoc(doc(db, "participants", currentId), cleanDoc);
    setCurrentUser(cleanDoc);
    setSaveStatus("saved");
    setTimeout(()=>setSaveStatus(""),2000);
  }

  // ── Save admin results
  async function saveAdmin(data) {
    await setDoc(doc(db, "admin", "results"), data);
    setSaveStatus("saved");
    setTimeout(()=>setSaveStatus(""),2000);
  }

  const sorted = Object.values(participants)
    .sort((a,b) => calcTotal(b,adminResults) - calcTotal(a,adminResults));

  // ── Routing
  if (screen==="loading" || screen==="register") return (
    <RegisterScreen nameInput={nameInput} setNameInput={setNameInput}
      pinInput={pinInput} setPinInput={setPinInput}
      loginError={loginError}
      onRegister={handleRegister} locked={adminResults.guessesLocked}
      sorted={sorted} getTotal={p=>calcTotal(p,adminResults)}
      loading={screen==="loading"} />
  );

  if (screen==="home") return (
    <HomeScreen
      currentUser={currentUser} sorted={sorted}
      getTotal={p=>calcTotal(p,adminResults)}
      adminResults={adminResults}
      onGuesses={()=>setScreen("guesses")}
      onAdmin={()=>setScreen("admin-login")}
      onRanking={()=>setScreen("ranking")}
      onRules={()=>setScreen("rules")}
      onViewGuesses={uid=>{ setViewingUid(uid); setScreen("view-guesses"); }}
    />
  );

  if (screen==="rules") return <RulesScreen onBack={()=>setScreen("home")} />;

  if (screen==="admin-login") return (
    <AdminLogin code={adminCode} setCode={setAdminCode}
      onLogin={()=>{ if(adminCode===ADMIN_CODE) setScreen("admin"); else alert("Senha incorreta"); }}
      onBack={()=>setScreen("home")} />
  );

  if (screen==="admin") return (
    <AdminPanel results={adminResults} setResults={setAdminResults}
      onSave={saveAdmin} saveStatus={saveStatus}
      onBack={()=>setScreen("home")}
      participants={participants}
    />
  );

  if (screen==="ranking") return (
    <RankingScreen sorted={sorted} getTotal={p=>calcTotal(p,adminResults)}
      onBack={()=>setScreen("home")} currentId={currentId}
      guessesVisible={adminResults.guessesVisible || adminResults.guessesLocked}
      onViewGuesses={uid=>{ setViewingUid(uid); setScreen("view-guesses"); }}
    />
  );

  if (screen==="guesses") return (
    <GuessesScreen
      user={currentUser} adminResults={adminResults}
      locked={adminResults.guessesLocked}
      onSave={saveGuesses} saveStatus={saveStatus}
      onBack={()=>setScreen("home")}
    />
  );

  if (screen==="view-guesses") {
    const viewed = participants[viewingUid];
    return (
      <GuessesScreen
        user={viewed} adminResults={adminResults}
        locked={true} readOnly={true}
        onSave={()=>{}} saveStatus=""
        onBack={()=>setScreen("ranking")}
      />
    );
  }

  return null;
}

// ─── REGISTER ────────────────────────────────────────────────────────────────
function RegisterScreen({ nameInput, setNameInput, pinInput, setPinInput, loginError, onRegister, locked, sorted, getTotal, loading }) {
  return (
    <div style={{ maxWidth:400,margin:"0 auto",padding:"2rem 1rem" }}>
      <div style={{ textAlign:"center",marginBottom:"1.5rem" }}>
        <div style={{ fontSize:52,marginBottom:8 }}>🏆</div>
        <div style={{ display:"inline-flex",alignItems:"center",gap:6,marginBottom:6 }}>
          <span style={{ fontSize:22 }}>🇧🇷</span>
          <h1 style={{ margin:0,fontSize:24,fontWeight:500 }}>Bolão do Hexa</h1>
          <span style={{ fontSize:22 }}>🇧🇷</span>
        </div>
        <div style={{ display:"inline-block",background:"#009c3b",color:"#fff",borderRadius:"var(--border-radius-md)",padding:"3px 14px",fontSize:13,fontWeight:500,letterSpacing:"0.04em" }}>
          VENCERÁS OU MAMARÁS?
        </div>
      </div>

      {/* Login form */}
      <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1.5rem",marginBottom:"1rem" }}>
        <p style={{ margin:"0 0 16px",fontWeight:500,fontSize:16 }}>
          {locked ? "Acessar meus palpites 👁️" : "Bem-vindo! 👋"}
        </p>

        <label style={{ fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:4 }}>Seu nome</label>
        <input type="text" placeholder="Ex: Thiago" value={nameInput}
          onChange={e=>setNameInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&onRegister()}
          style={{ width:"100%",marginBottom:12,fontSize:15 }} autoFocus />

        <label style={{ fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:4 }}>PIN</label>
        <input type="number" placeholder="PIN de acesso"
          value={pinInput} onChange={e=>setPinInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&onRegister()}
          style={{ width:"100%",marginBottom:loginError?8:16,fontSize:15,letterSpacing:"0.15em" }} />

        {loginError && (
          <p style={{ margin:"0 0 12px",fontSize:13,color:"var(--color-text-danger)",fontWeight:500 }}>
            ⚠️ {loginError}
          </p>
        )}

        <button onClick={onRegister} style={{ width:"100%",fontWeight:500,padding:"10px" }}
          disabled={loading||!nameInput.trim()||!pinInput.trim()}>
          {loading ? "Carregando..." : locked ? "Acessar" : "Entrar no bolão"} <i className="ti ti-arrow-right" />
        </button>

        <p style={{ margin:"12px 0 0",fontSize:12,color:"var(--color-text-tertiary)",textAlign:"center" }}>
          O PIN foi enviado pelo administrador do bolão <span style={{ opacity:0.4 }}>· v8</span>
        </p>
      </div>

      {/* Ranking preview */}
      {sorted && sorted.length > 0 && (
        <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1.25rem" }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
            <span style={{ fontSize:14,fontWeight:500 }}>Placar ao vivo 🔴</span>
            <span style={{ fontSize:12,color:"var(--color-text-tertiary)" }}>{sorted.length} participantes</span>
          </div>
          {sorted.slice(0,6).map((p,i)=>(
            <div key={p.uid||p.id||i} style={{ display:"flex",alignItems:"center",gap:10,padding:"5px 0",borderTop:i>0?"0.5px solid var(--color-border-tertiary)":"none" }}>
              <span style={{ fontSize:i<3?16:13,width:24,textAlign:"center" }}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span>
              <span style={{ flex:1,fontSize:14 }}>{p.name}</span>
              <span style={{ fontSize:14,fontWeight:500 }}>{getTotal(p)} pts</span>
            </div>
          ))}
          {sorted.length>6 && (
            <p style={{ margin:"8px 0 0",fontSize:12,color:"var(--color-text-tertiary)",textAlign:"center" }}>
              +{sorted.length-6} participantes
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomeScreen({ currentUser, sorted, getTotal, adminResults, onGuesses, onAdmin, onRanking, onRules, onViewGuesses }) {
  const locked = adminResults.guessesLocked;
  return (
    <div style={{ maxWidth:480,margin:"0 auto",padding:"2rem 1rem" }}>
      <div style={{ textAlign:"center",marginBottom:"2rem" }}>
        <div style={{ fontSize:44,marginBottom:6 }}>🏆</div>
        <div style={{ display:"inline-flex",alignItems:"center",gap:6,marginBottom:6 }}>
          <span style={{ fontSize:22 }}>🇧🇷</span>
          <h1 style={{ margin:0,fontSize:24,fontWeight:500 }}>Bolão do Hexa</h1>
          <span style={{ fontSize:22 }}>🇧🇷</span>
        </div>
        <br/>
        <div style={{ display:"inline-block",background:"#009c3b",color:"#fff",borderRadius:"var(--border-radius-md)",padding:"3px 14px",fontSize:13,fontWeight:500,letterSpacing:"0.04em",marginBottom:6 }}>
          VENCERÁS OU MAMARÁS?
        </div>
        <p style={{ margin:0,fontSize:12,color:"var(--color-text-secondary)" }}>EUA · México · Canadá · 11 Jun – 19 Jul</p>
      </div>

      {/* Lock status banner */}
      {locked && (
        <div style={{ background:"var(--color-background-warning)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:"1rem",display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:16 }}>🔒</span>
          <p style={{ margin:0,fontSize:13,color:"var(--color-text-warning)",fontWeight:500 }}>Palpites encerrados — clique em qualquer participante para ver os chutes dele</p>
        </div>
      )}

      {/* Current user card */}
      <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1.25rem",marginBottom:"1rem" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <p style={{ margin:0,fontSize:12,color:"var(--color-text-secondary)" }}>Logado como</p>
            <p style={{ margin:0,fontSize:16,fontWeight:500 }}>{currentUser?.name}</p>
          </div>
          <button onClick={onGuesses} style={{ padding:"8px 18px",fontWeight:500 }}>
            {locked ? "Ver meus palpites" : "Meus palpites"} <i className={`ti ti-${locked?"eye":"edit"}`} />
          </button>
        </div>
      </div>

      {/* Ranking preview */}
      {sorted.length>0 && (
        <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1.25rem",marginBottom:"1rem" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <span style={{ fontSize:14,fontWeight:500 }}>Placar ao vivo 🔴</span>
            <button onClick={onRanking} style={{ background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--color-text-secondary)",padding:0 }}>
              Ver tudo <i className="ti ti-trophy" />
            </button>
          </div>
          {sorted.slice(0,6).map((p,i)=>{
            const isMe = p.uid===currentUser?.uid;
            const clickable = locked && !isMe;
            return (
              <div key={p.uid}
                onClick={clickable ? ()=>onViewGuesses(p.uid) : undefined}
                style={{ display:"flex",alignItems:"center",gap:10,padding:"5px 0",borderTop:i>0?"0.5px solid var(--color-border-tertiary)":"none",cursor:clickable?"pointer":"default" }}>
                <span style={{ fontSize:i<3?16:13,width:24,textAlign:"center" }}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span>
                <span style={{ flex:1,fontSize:14,fontWeight:isMe?500:400 }}>
                  {p.name}{isMe?" (você)":""}
                </span>
                <span style={{ fontSize:14,fontWeight:500 }}>{getTotal(p)} pts</span>
                {clickable && <i className="ti ti-eye" style={{ color:"var(--color-text-tertiary)",fontSize:14 }}/>}
              </div>
            );
          })}
          {sorted.length>6 && <p style={{ margin:"8px 0 0",fontSize:12,color:"var(--color-text-tertiary)",textAlign:"center" }}>+{sorted.length-6} participantes</p>}
        </div>
      )}

      <div style={{ display:"flex",gap:8 }}>
        <button onClick={onRules} style={{ flex:1,background:"none",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-secondary)",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
          <i className="ti ti-info-circle" /> Regras
        </button>
        <button onClick={onAdmin} style={{ flex:1,background:"none",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-tertiary)",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
          <i className="ti ti-settings" /> Admin
        </button>
      </div>
    </div>
  );
}

// ─── GUESSES SCREEN ───────────────────────────────────────────────────────────
function GuessesScreen({ user, adminResults, locked, readOnly, onSave, saveStatus, onBack }) {
  const [tab, setTab] = useState("brasil");
  const [local, setLocal] = useState(() => {
    // Explicitly pick only valid guess fields — never carry over id/name/pin/etc
    const brazil = user?.brazil || {};
    const groups = {};
    const srcGroups = user?.groups || {};
    // Only copy valid group IDs (A-L), skip any non-group fields like 'id'
    GROUPS.forEach(g => { if (srcGroups[g.id]) groups[g.id] = srcGroups[g.id]; });
    const knockout = {};
    const srcKO = user?.knockout || {};
    // Only copy valid KO round IDs, skip name/pin/etc
    KO_ROUNDS.forEach(r => { if (srcKO[r.id]) knockout[r.id] = srcKO[r.id]; });
    if (srcKO.r32entrants) knockout.r32entrants = srcKO.r32entrants;
    return { brazil, groups, knockout };
  });

  const isReadOnly = locked || readOnly;

  function handleSave() {
    if (isReadOnly) return;
    onSave(local);
  }

  function updBrazil(gId, val) {
    if (isReadOnly) return;
    setLocal(l => ({ ...l, brazil: { ...l.brazil, [gId]: val } }));
  }
  function updGroup(gId, field, team) {
    if (isReadOnly) return;
    setLocal(l => ({ ...l, groups: { ...l.groups, [gId]: { ...(l.groups[gId]||{}), [field]: team } } }));
  }
  function updKO(rId, idx, team) {
    if (isReadOnly) return;
    setLocal(l => {
      const slots = [...(l.knockout[rId]||[])]; slots[idx] = team||null;
      const ri = KO_ROUNDS.findIndex(r=>r.id===rId);
      let newKO = { ...l.knockout, [rId]: slots };
      let ix = idx;
      for (let i=ri+1; i<KO_ROUNDS.length; i++) {
        ix = Math.floor(ix/2);
        const ds = [...(newKO[KO_ROUNDS[i].id]||[])]; ds[ix]=null;
        newKO = { ...newKO, [KO_ROUNDS[i].id]: ds };
      }
      return { ...l, knockout: newKO };
    });
  }

  return (
    <div style={{ maxWidth:720,margin:"0 auto",padding:"12px 12px 2rem" }}>
      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:"1rem" }}>
        <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",padding:"4px",flexShrink:0 }}>
          <i className="ti ti-arrow-left" style={{ fontSize:22,color:"var(--color-text-secondary)" }} />
        </button>
        <div style={{ flex:1,minWidth:0 }}>
          <p style={{ margin:0,fontSize:11,color:"var(--color-text-secondary)" }}>{readOnly?"Palpites de":"Seus palpites"}</p>
          <h2 style={{ margin:0,fontSize:17,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{user?.name}</h2>
        </div>
        {!isReadOnly && (
          <button onClick={handleSave} style={{ display:"flex",alignItems:"center",gap:5,padding:"7px 14px",flexShrink:0,fontSize:13 }}>
            <i className="ti ti-device-floppy" />
            {saveStatus==="saved"?"✓ Salvo!":saveStatus==="saving"?"...":"Salvar"}
          </button>
        )}
        {isReadOnly && !readOnly && (
          <div style={{ display:"flex",alignItems:"center",gap:5,padding:"6px 10px",background:"var(--color-background-warning)",borderRadius:"var(--border-radius-md)",fontSize:12,color:"var(--color-text-warning)",flexShrink:0 }}>
            🔒 Somente leitura
          </div>
        )}
      </div>
      <TabBar
        tabs={[{id:"brasil",label:"Brasil"},{id:"grupos",label:"Grupos"},{id:"matamata",label:"Mata-mata"}]}
        active={tab} onChange={setTab}
      />
      {tab==="brasil" && <BrazilTab p={local} adminResults={adminResults} onBrazil={updBrazil} readOnly={isReadOnly} />}
      {tab==="grupos" && <GroupsTab p={local} adminResults={adminResults} onGroup={updGroup} readOnly={isReadOnly} />}
      {tab==="matamata" && <KOTab p={local} adminResults={adminResults} onKO={updKO} readOnly={isReadOnly} />}
    </div>
  );
}

// ─── BRAZIL TAB ───────────────────────────────────────────────────────────────
function BrazilTab({ p, adminResults, onBrazil, readOnly }) {
  return (
    <div>
      <div style={{ background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"8px 12px",marginBottom:12 }}>
        <p style={{ margin:0,fontSize:11,color:"var(--color-text-secondary)",lineHeight:1.5 }}>
          🎯 Placar exato: 20pts · ⚽ Vencedor + saldo: 10pts · ✅ Vencedor: 5pts · ❌ Errou: 0pts
        </p>
      </div>
      {BRAZIL_GAMES.map(game=>{
        // Brasil always on the left
        const brazilHome = game.home;
        const opponent = game.opponent;
        const guess = p.brazil[game.id]||{homeGoals:"",awayGoals:""};
        // brazilGoals is always homeGoals in our data model (Brasil is "home" in the guess)
        // but visually Brasil always appears left, so we just label accordingly
        const result = adminResults.brazil[game.id]||{};
        const pts = calcBrazilPts(guess, result);
        const hasResult = result.homeGoals!==undefined && result.homeGoals!=="";

        return (
          <div key={game.id} style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"12px 14px",marginBottom:10 }}>
            {/* Header row */}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
              <span style={{ fontSize:12,color:"var(--color-text-secondary)" }}>{game.label} · {game.date}</span>
              <PtsBadge pts={pts} max={20} />
            </div>

            {/* Score row: Brasil | input × input | Adversário */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:8 }}>
              {/* Left: Brasil */}
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <Flag team="Brasil" size={30} />
                <span style={{ fontSize:14,fontWeight:500 }}>Brasil</span>
              </div>

              {/* Center: score inputs */}
              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <input type="number" min="0" max="20"
                  value={brazilHome ? guess.homeGoals : guess.awayGoals}
                  onChange={e => onBrazil(game.id, brazilHome
                    ? {...guess, homeGoals:e.target.value}
                    : {...guess, awayGoals:e.target.value}
                  )}
                  readOnly={readOnly} disabled={readOnly}
                  style={{ width:48,textAlign:"center",fontSize:22,fontWeight:600,padding:"6px 0" }}
                  placeholder="–"
                />
                <span style={{ fontSize:16,color:"var(--color-text-tertiary)",fontWeight:300 }}>×</span>
                <input type="number" min="0" max="20"
                  value={brazilHome ? guess.awayGoals : guess.homeGoals}
                  onChange={e => onBrazil(game.id, brazilHome
                    ? {...guess, awayGoals:e.target.value}
                    : {...guess, homeGoals:e.target.value}
                  )}
                  readOnly={readOnly} disabled={readOnly}
                  style={{ width:48,textAlign:"center",fontSize:22,fontWeight:600,padding:"6px 0" }}
                  placeholder="–"
                />
              </div>

              {/* Right: Adversário */}
              <div style={{ display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end" }}>
                <span style={{ fontSize:14,fontWeight:500,textAlign:"right" }}>{opponent}</span>
                <Flag team={opponent} size={30} />
              </div>
            </div>

            {/* Result row */}
            {hasResult && (
              <div style={{ marginTop:10,padding:"6px 10px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                <span style={{ fontSize:12,color:"var(--color-text-secondary)" }}>Resultado oficial:</span>
                <span style={{ fontSize:13,fontWeight:500 }}>
                  Brasil {brazilHome ? result.homeGoals : result.awayGoals}
                  {" × "}
                  {brazilHome ? result.awayGoals : result.homeGoals} {opponent}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── GROUPS TAB ───────────────────────────────────────────────────────────────
function GroupsTab({ p, adminResults, onGroup, readOnly }) {
  return (
    <div>
      <div style={{ background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:14 }}>
        <p style={{ margin:0,fontSize:12,color:"var(--color-text-secondary)" }}>
          Posição exata: 5pts por seleção · Entre os dois primeiros: 2pts
        </p>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))",gap:10 }}>
        {GROUPS.map(group=>{
          const guess=p.groups[group.id]||{};
          const result=adminResults.groups[group.id]||{};
          const pts=calcGroupPts(guess,result);
          return (
            <div key={group.id} style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <span style={{ fontWeight:500,fontSize:14 }}>Grupo {group.id}</span>
                <PtsBadge pts={pts} max={10} />
              </div>
              {["first","second"].map((field,fi)=>(
                <div key={field} style={{ marginBottom:fi===0?8:0 }}>
                  <label style={{ fontSize:11,color:"var(--color-text-secondary)" }}>{fi===0?"1º colocado":"2º colocado"}</label>
                  <select value={guess[field]||""} onChange={e=>onGroup(group.id,field,e.target.value)}
                    disabled={readOnly} style={{ width:"100%",marginTop:3,opacity:readOnly?0.7:1 }}>
                    <option value="">Selecione...</option>
                    {group.teams.map(t=><option key={t} value={t}>{FLAGS[t]||""} {t}</option>)}
                  </select>
                </div>
              ))}
              {result.first&&(
                <div style={{ marginTop:8,padding:"5px 8px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",fontSize:11,color:"var(--color-text-secondary)" }}>
                  1º {result.first} · 2º {result.second}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── KNOCKOUT TAB ─────────────────────────────────────────────────────────────
function KOTab({ p, adminResults, onKO, readOnly }) {
  const [activeRound, setActiveRound] = useState("r32");
  const unlocked = adminResults.knockoutUnlocked;
  const koGuesses = p.knockout || {};
  const adminKO = adminResults.knockout || {};
  const entrants = adminKO.r32entrants || Array(32).fill(null);

  if (!unlocked) return (
    <div style={{ textAlign:"center",padding:"3rem 1rem" }}>
      <div style={{ fontSize:48,marginBottom:12 }}>🔒</div>
      <p style={{ fontWeight:500,marginBottom:8,fontSize:16 }}>Mata-mata bloqueado</p>
      <p style={{ fontSize:14,color:"var(--color-text-secondary)",margin:0 }}>
        O administrador vai liberar o bracket quando o chaveamento estiver definido.
      </p>
    </div>
  );

  function teamsForRound(roundId) {
    const ri=KO_ROUNDS.findIndex(r=>r.id===roundId);
    if(ri===0) return entrants;
    return koGuesses[KO_ROUNDS[ri-1].id]||Array(KO_ROUNDS[ri-1].slots/2).fill(null);
  }
  function isAccessible(roundId) {
    const ri=KO_ROUNDS.findIndex(r=>r.id===roundId);
    if(ri===0) return entrants.some(Boolean);
    const prev=koGuesses[KO_ROUNDS[ri-1].id]||[];
    return prev.filter(Boolean).length===KO_ROUNDS[ri-1].slots/2;
  }

  const round=KO_ROUNDS.find(r=>r.id===activeRound);
  const teams=teamsForRound(activeRound);
  const picks=koGuesses[activeRound]||[];
  const officialW=adminKO[activeRound]||[];
  const numM=round.slots/2;

  return (
    <div>
      <div style={{ background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:14 }}>
        <p style={{ margin:0,fontSize:12,color:"var(--color-text-secondary)" }}>
          R32: 5pts · Oitavas: 10pts · Quartas: 15pts · Semis: 20pts · Campeão: 60pts
        </p>
      </div>
      <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:16 }}>
        {KO_ROUNDS.map(r=>{
          const acc=isAccessible(r.id);
          const done=(koGuesses[r.id]||[]).filter(Boolean).length===r.slots/2;
          return (
            <button key={r.id} onClick={()=>acc&&setActiveRound(r.id)} style={{
              padding:"6px 14px",borderRadius:"var(--border-radius-md)",fontSize:13,
              border:activeRound===r.id?"2px solid var(--color-text-primary)":"0.5px solid var(--color-border-tertiary)",
              background:activeRound===r.id?"var(--color-background-secondary)":"var(--color-background-primary)",
              fontWeight:activeRound===r.id?500:400,
              color:acc?"var(--color-text-primary)":"var(--color-text-tertiary)",
              cursor:acc?"pointer":"not-allowed",opacity:acc?1:0.45,
            }}>{r.short}{done?" ✓":""}</button>
          );
        })}
      </div>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
        <span style={{ fontWeight:500,fontSize:15 }}>{round.label}</span>
        <span style={{ fontSize:12,color:"var(--color-text-tertiary)",background:"var(--color-background-secondary)",padding:"2px 8px",borderRadius:"var(--border-radius-md)" }}>{round.points}pts cada</span>
        <span style={{ fontSize:12,color:"var(--color-text-secondary)",marginLeft:"auto" }}>{picks.filter(Boolean).length}/{numM} preenchidos</span>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8 }}>
        {Array.from({length:numM},(_,mi)=>{
          const t1=teams[mi*2]||null, t2=teams[mi*2+1]||null;
          const picked=picks[mi]||null;
          const official=officialW[mi]||null;
          const correct=official&&picked&&picked===official;
          const wrong=official&&picked&&picked!==official;
          return (
            <div key={mi} style={{ background:"var(--color-background-primary)",border:correct?"1.5px solid var(--color-border-success)":wrong?"1.5px solid var(--color-border-danger)":"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",overflow:"hidden" }}>
              <div style={{ padding:"4px 10px",background:"var(--color-background-secondary)",fontSize:11,color:"var(--color-text-tertiary)",fontWeight:500,display:"flex",justifyContent:"space-between" }}>
                <span>#{mi+1}</span>
                {correct&&<span style={{ color:"var(--color-text-success)" }}>✓ acertou</span>}
                {wrong&&<span style={{ color:"var(--color-text-danger)" }}>✗ errou</span>}
              </div>
              {[t1,t2].map((team,ti)=>{
                const isP=picked===team;
                const bg=COLORS[team]||"#888";
                return (
                  <div key={ti} onClick={()=>!readOnly&&team&&t1&&t2&&onKO(activeRound,mi,team)} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 10px",cursor:!readOnly&&team&&t1&&t2?"pointer":"default",background:isP?bg+"1a":"transparent",borderTop:ti>0?"0.5px solid var(--color-border-tertiary)":"none",transition:"background 0.12s",opacity:!team?0.4:1 }}>
                    {team?<Flag team={team} size={24}/>:<span style={{ width:24,height:24,borderRadius:"50%",background:"var(--color-background-secondary)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:12 }}>?</span>}
                    <span style={{ fontSize:12,flex:1,fontWeight:isP?500:400,lineHeight:1.2 }}>{team||"A definir"}</span>
                    {isP&&!official&&<span style={{ width:8,height:8,borderRadius:"50%",background:bg,flexShrink:0 }}/>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {(()=>{
        const ri=KO_ROUNDS.findIndex(r=>r.id===activeRound);
        const allPicked=picks.filter(Boolean).length===numM;
        return allPicked&&ri<KO_ROUNDS.length-1?(
          <button onClick={()=>setActiveRound(KO_ROUNDS[ri+1].id)} style={{ width:"100%",marginTop:12,padding:"10px",fontWeight:500 }}>
            Ir para {KO_ROUNDS[ri+1].label} <i className="ti ti-arrow-right"/>
          </button>
        ):null;
      })()}
    </div>
  );
}

// ─── ADMIN LOGIN ──────────────────────────────────────────────────────────────
function AdminLogin({ code, setCode, onLogin, onBack }) {
  return (
    <div style={{ maxWidth:360,margin:"0 auto",padding:"2rem 1rem" }}>
      <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",marginBottom:"1.5rem",display:"flex",alignItems:"center",gap:6,fontSize:14,color:"var(--color-text-secondary)",padding:0 }}>
        <i className="ti ti-arrow-left"/> Voltar
      </button>
      <h2 style={{ marginBottom:"1.5rem" }}>Área do administrador</h2>
      <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1.25rem" }}>
        <label style={{ fontSize:13,color:"var(--color-text-secondary)",display:"block",marginBottom:8 }}>Senha</label>
        <input type="password" value={code} onChange={e=>setCode(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&onLogin()} placeholder="Código de admin"
          style={{ width:"100%",marginBottom:12 }}/>
        <button onClick={onLogin} style={{ width:"100%" }}>Entrar</button>
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({ results, setResults, onSave, saveStatus, onBack, participants }) {
  const [tab, setTab] = useState("brazil");

  function updBrazil(gId,field,val) {
    setResults({...results,brazil:{...results.brazil,[gId]:{...(results.brazil[gId]||{}),[field]:val}}});
  }
  function updGroup(gId,field,val) {
    setResults({...results,groups:{...results.groups,[gId]:{...(results.groups[gId]||{}),[field]:val}}});
  }

  return (
    <div style={{ maxWidth:720,margin:"0 auto",padding:"1.5rem 1rem" }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem" }}>
        <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",padding:0 }}>
          <i className="ti ti-arrow-left" style={{ fontSize:20,color:"var(--color-text-secondary)" }}/>
        </button>
        <h2 style={{ margin:0 }}>Painel do admin</h2>
        <span style={{ marginLeft:"auto",fontSize:13,color:"var(--color-text-secondary)" }}>
          {Object.keys(participants).length} participantes
        </span>
        <button onClick={()=>onSave(results)} style={{ padding:"7px 16px" }}>
          {saveStatus==="saved"?"✓ Salvo!":"Salvar tudo"}
        </button>
      </div>
      <TabBar
        tabs={[{id:"brazil",label:"Brasil"},{id:"grupos",label:"Grupos"},{id:"matamata",label:"Mata-mata"}]}
        active={tab} onChange={setTab}
      />

      {tab==="brazil" && (
        <div>
          <p style={{ fontSize:13,color:"var(--color-text-secondary)",marginBottom:12 }}>Resultados dos jogos do Brasil na fase de grupos.</p>
          {BRAZIL_GAMES.map(game=>{
            const home=game.home?"Brasil":game.opponent, away=game.home?game.opponent:"Brasil";
            const r=results.brazil[game.id]||{};
            return (
              <div key={game.id} style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",marginBottom:10 }}>
                <p style={{ margin:"0 0 10px",fontWeight:500,fontSize:14 }}>{game.label} · {game.date} · {home} × {away}</p>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <Flag team={home} size={26}/><span style={{ fontSize:13 }}>{home}</span>
                  <input type="number" min="0" max="20" value={r.homeGoals||""} placeholder="0"
                    onChange={e=>updBrazil(game.id,"homeGoals",e.target.value)}
                    style={{ width:56,textAlign:"center",fontSize:18,fontWeight:500 }}/>
                  <span style={{ fontSize:16,color:"var(--color-text-secondary)" }}>×</span>
                  <input type="number" min="0" max="20" value={r.awayGoals||""} placeholder="0"
                    onChange={e=>updBrazil(game.id,"awayGoals",e.target.value)}
                    style={{ width:56,textAlign:"center",fontSize:18,fontWeight:500 }}/>
                  <span style={{ fontSize:13 }}>{away}</span><Flag team={away} size={26}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab==="grupos" && (
        <div>
          <p style={{ fontSize:13,color:"var(--color-text-secondary)",marginBottom:12 }}>1º e 2º colocado de cada um dos 12 grupos.</p>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:10 }}>
            {GROUPS.map(group=>{
              const r=results.groups[group.id]||{};
              return (
                <div key={group.id} style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem" }}>
                  <p style={{ margin:"0 0 10px",fontWeight:500,fontSize:14 }}>Grupo {group.id}</p>
                  {["first","second"].map((field,fi)=>(
                    <div key={field} style={{ marginBottom:fi===0?8:0 }}>
                      <label style={{ fontSize:12,color:"var(--color-text-secondary)" }}>{fi===0?"1º colocado":"2º colocado"}</label>
                      <select value={r[field]||""} onChange={e=>updGroup(group.id,field,e.target.value)} style={{ width:"100%",marginTop:4 }}>
                        <option value="">Selecione...</option>
                        {group.teams.map(t=><option key={t} value={t}>{FLAGS[t]||""} {t}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="matamata" && (
        <AdminKO results={results} setResults={setResults} onSave={onSave} />
      )}
    </div>
  );
}

// ─── TOGGLE CARD helper ───────────────────────────────────────────────────────
function ToggleCard({ title, description, active, labelOn, labelOff, colorOn="success", onToggle }) {
  const bgMap = { success:"var(--color-background-success)", warning:"var(--color-background-warning)", info:"var(--color-background-info)" };
  const clMap = { success:"var(--color-text-success)", warning:"var(--color-text-warning)", info:"var(--color-text-info)" };
  return (
    <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",marginBottom:10 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12 }}>
        <div style={{ flex:1 }}>
          <p style={{ margin:0,fontWeight:500,fontSize:14 }}>{title}</p>
          <p style={{ margin:"4px 0 0",fontSize:13,color:"var(--color-text-secondary)" }}>{description}</p>
        </div>
        <button onClick={onToggle} style={{
          background:active?bgMap[colorOn]:"var(--color-background-secondary)",
          color:active?clMap[colorOn]:"var(--color-text-primary)",
          border:"0.5px solid var(--color-border-tertiary)",padding:"8px 16px",
          borderRadius:"var(--border-radius-md)",fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0
        }}>{active?labelOn:labelOff}</button>
      </div>
    </div>
  );
}

// ─── ADMIN KO ─────────────────────────────────────────────────────────────────
function AdminKO({ results, setResults, onSave }) {
  const [sub, setSub] = useState("bracket");
  const ko = results.knockout || {};
  const entrants = ko.r32entrants || Array(32).fill(null);

  function setEntrant(idx, team) {
    const arr=[...entrants]; arr[idx]=team||null;
    setResults({...results,knockout:{...ko,r32entrants:arr}});
  }
  function setOfficialWinner(roundId, matchIdx, team) {
    const existing=[...(ko[roundId]||[])];
    const wasAlready=existing[matchIdx]===team;
    existing[matchIdx]=wasAlready?null:team;
    const ri=KO_ROUNDS.findIndex(r=>r.id===roundId);
    let newKO={...ko,[roundId]:existing};
    let ix=matchIdx;
    for(let i=ri+1;i<KO_ROUNDS.length;i++){
      ix=Math.floor(ix/2);
      const ds=[...(newKO[KO_ROUNDS[i].id]||[])]; ds[ix]=null;
      newKO={...newKO,[KO_ROUNDS[i].id]:ds};
    }
    setResults({...results,knockout:newKO});
  }
  function toggleUnlock() {
    const r={...results,knockoutUnlocked:!results.knockoutUnlocked};
    setResults(r); onSave(r);
  }
  function officialTeams(roundId) {
    const ri=KO_ROUNDS.findIndex(r=>r.id===roundId);
    if(ri===0) return entrants;
    return ko[KO_ROUNDS[ri-1].id]||Array(KO_ROUNDS[ri-1].slots/2).fill(null);
  }
  const filledEntrants=entrants.filter(Boolean).length;
  const SUB=[{id:"bracket",label:"Chaveamento R32"},{id:"results",label:"Resultados"},{id:"vis",label:"Visibilidade"}];

  return (
    <div>
      <TabBar tabs={SUB} active={sub} onChange={setSub}/>
      {sub==="bracket" && (
        <div>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"8px 12px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)" }}>
            <span style={{ fontSize:13,color:"var(--color-text-secondary)" }}>Confrontos preenchidos: <strong style={{ color:"var(--color-text-primary)" }}>{Math.floor(filledEntrants/2)}/16</strong></span>
            {filledEntrants===32&&<span style={{ fontSize:12,color:"var(--color-text-success)",fontWeight:500 }}>✓ Completo</span>}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:10 }}>
            {Array.from({length:16},(_,mi)=>{
              const i1=mi*2,i2=mi*2+1;
              return (
                <div key={mi} style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"10px 14px" }}>
                  <p style={{ margin:"0 0 8px",fontSize:12,fontWeight:500,color:"var(--color-text-secondary)" }}>Partida #{mi+1}</p>
                  {[i1,i2].map((idx,side)=>(
                    <div key={idx} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:side===0?6:0 }}>
                      {entrants[idx]?<Flag team={entrants[idx]} size={22}/>:<span style={{ width:22,height:22,borderRadius:"50%",background:"var(--color-background-secondary)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"var(--color-text-tertiary)",flexShrink:0 }}>?</span>}
                      <select value={entrants[idx]||""} onChange={e=>setEntrant(idx,e.target.value)} style={{ flex:1,fontSize:13 }}>
                        <option value="">Time {side+1}...</option>
                        {ALL_TEAMS.map(t=><option key={t} value={t}>{FLAGS[t]||""} {t}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {sub==="results" && (
        <div>
          <p style={{ fontSize:13,color:"var(--color-text-secondary)",marginBottom:16 }}>Clique no vencedor de cada partida. Clique novamente para desfazer.</p>
          {KO_ROUNDS.map((round,ri)=>{
            const teams=officialTeams(round.id);
            const winners=ko[round.id]||[];
            const numM=round.slots/2;
            const doneCount=(ko[round.id]||[]).filter(Boolean).length;
            return (
              <div key={round.id} style={{ marginBottom:24 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                  <span style={{ fontSize:14,fontWeight:500 }}>{round.label}</span>
                  <span style={{ fontSize:11,color:"var(--color-text-tertiary)",background:"var(--color-background-secondary)",padding:"2px 8px",borderRadius:"var(--border-radius-md)" }}>{round.points}pts</span>
                  <span style={{ fontSize:12,color:doneCount===numM?"var(--color-text-success)":"var(--color-text-secondary)" }}>{doneCount}/{numM}</span>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:8 }}>
                  {Array.from({length:numM},(_,mi)=>{
                    const t1=teams[mi*2]||null,t2=teams[mi*2+1]||null;
                    const winner=winners[mi]||null;
                    return (
                      <div key={mi} style={{ background:"var(--color-background-primary)",border:winner?"1.5px solid var(--color-border-success)":"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",overflow:"hidden" }}>
                        <div style={{ padding:"5px 10px 3px",fontSize:11,color:"var(--color-text-tertiary)",fontWeight:500,background:"var(--color-background-secondary)" }}>
                          {round.short} #{mi+1}{winner&&<span style={{ color:"var(--color-text-success)",marginLeft:4 }}>✓</span>}
                        </div>
                        {[t1,t2].map((team,ti)=>{
                          const isW=winner===team;
                          const bg=COLORS[team]||"#888";
                          return (
                            <div key={ti} onClick={()=>team&&setOfficialWinner(round.id,mi,team)} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 10px",cursor:team?"pointer":"default",background:isW?bg+"22":"transparent",borderTop:ti>0?"0.5px solid var(--color-border-tertiary)":"none",transition:"background 0.12s" }}>
                              {team?(<><Flag team={team} size={24}/><span style={{ fontSize:13,flex:1,fontWeight:isW?500:400 }}>{team}</span>{isW&&<span style={{ fontSize:11,color:"var(--color-text-success)",fontWeight:500 }}>Vencedor ✓</span>}</>):(<span style={{ fontSize:12,color:"var(--color-text-tertiary)",fontStyle:"italic" }}>A definir</span>)}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {sub==="vis" && (
        <div>
          {/* Toggle: lock/unlock guesses */}
          <ToggleCard
            title="Bloquear palpites"
            description={results.guessesLocked
              ? "Palpites bloqueados — ninguém pode editar ou entrar no bolão."
              : "Aberto — participantes podem entrar e editar palpites."}
            active={results.guessesLocked}
            labelOn="🔒 Bloquear"
            labelOff="🔓 Desbloquear"
            colorOn="warning"
            onToggle={()=>{
              const r={...results, guessesLocked:!results.guessesLocked};
              setResults(r); onSave(r);
            }}
          />

          {/* Toggle: show/hide guesses to everyone */}
          <ToggleCard
            title="Revelar palpites para todos"
            description={results.guessesVisible
              ? "Palpites visíveis — qualquer participante pode ver os chutes dos outros no ranking."
              : "Ocultos — cada um só vê os próprios palpites."}
            active={results.guessesVisible}
            labelOn="👁️ Ocultar"
            labelOff="👁️ Revelar"
            colorOn="info"
            onToggle={()=>{
              const r={...results, guessesVisible:!results.guessesVisible};
              setResults(r); onSave(r);
            }}
          />

          {/* Toggle: unlock knockout bracket */}
          <ToggleCard
            title="Liberar bracket do mata-mata"
            description={results.knockoutUnlocked
              ? "Participantes já podem preencher o bracket."
              : "Bloqueado — preencha o chaveamento R32 antes de liberar."}
            active={results.knockoutUnlocked}
            labelOn="🔒 Bloquear"
            labelOff="🔓 Liberar"
            colorOn="success"
            onToggle={toggleUnlock}
          />

          <p style={{ fontSize:13,color:"var(--color-text-secondary)",lineHeight:1.6,marginTop:16 }}>
            Fluxo recomendado para o mata-mata:<br/>
            1. Preencha os confrontos em "Chaveamento R32".<br/>
            2. Libere o bracket acima.<br/>
            3. Registre os vencedores em "Resultados" conforme os jogos acontecerem.<br/>
            A pontuação é atualizada automaticamente para todos.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── RANKING ─────────────────────────────────────────────────────────────────
function RankingScreen({ sorted, getTotal, onBack, currentId, guessesVisible, onViewGuesses }) {
  return (
    <div style={{ maxWidth:600,margin:"0 auto",padding:"1.5rem 1rem" }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem" }}>
        <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",padding:0 }}>
          <i className="ti ti-arrow-left" style={{ fontSize:20,color:"var(--color-text-secondary)" }}/>
        </button>
        <h2 style={{ margin:0 }}>Ranking geral</h2>
        <span style={{ marginLeft:"auto",fontSize:12,color:"var(--color-text-tertiary)" }}>ao vivo 🔴</span>
      </div>
      {guessesVisible && (
        <div style={{ background:"var(--color-background-info)",border:"0.5px solid var(--color-border-info)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:12,fontSize:13,color:"var(--color-text-info)" }}>
          👁️ Palpites revelados — clique em qualquer participante para ver os chutes dele
        </div>
      )}
      {sorted.length===0&&<p style={{ color:"var(--color-text-secondary)",textAlign:"center",padding:"2rem" }}>Nenhum participante ainda.</p>}
      {sorted.map((p,i)=>{
        const total=getTotal(p);
        const isMe=p.uid===currentId;
        const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":null;
        const clickable = guessesVisible && !isMe;
        return (
          <div key={p.uid}
            onClick={clickable ? ()=>onViewGuesses(p.uid) : undefined}
            style={{ background:"var(--color-background-primary)",border:isMe?"1.5px solid var(--color-border-info)":"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",marginBottom:8,display:"flex",alignItems:"center",gap:12,cursor:clickable?"pointer":"default",transition:"background 0.12s" }}>
            <span style={{ width:28,textAlign:"center",fontSize:i<3?18:14,color:"var(--color-text-secondary)" }}>{medal||`#${i+1}`}</span>
            <div style={{ flex:1 }}>
              <p style={{ margin:0,fontWeight:500,fontSize:15 }}>{p.name}{isMe&&<span style={{ fontSize:12,color:"var(--color-text-info)",marginLeft:6 }}>você</span>}</p>
            </div>
            <span style={{ fontSize:20,fontWeight:500 }}>{total}</span>
            {clickable && <i className="ti ti-eye" style={{ color:"var(--color-text-tertiary)",fontSize:16 }}/>}
          </div>
        );
      })}
    </div>
  );
}

// ─── RULES ────────────────────────────────────────────────────────────────────
function RulesScreen({ onBack }) {
  const sections = [
    { emoji:"🇧🇷", title:"Jogos do Brasil — Fase de Grupos", subtitle:"Palpite de placar para cada um dos 3 jogos do Brasil",
      rows:[
        { pts:20, icon:"🎯", label:"Placar exato", desc:"Ex: palpite 2×1 → resultado 2×1" },
        { pts:10, icon:"⚽", label:"Vencedor + saldo de gols certo", desc:"Ex: palpite 3×1 → resultado 2×0 (ambos vencem por +2)" },
        { pts:5,  icon:"✅", label:"Acertou o vencedor", desc:"Ex: palpite 1×0 → resultado 3×1" },
        { pts:0,  icon:"❌", label:"Errou o resultado", desc:"Previu empate e o Brasil ganhou, ou vice-versa" },
      ]
    },
    { emoji:"📊", title:"Classificação dos Grupos", subtitle:"Palpite de 1º e 2º colocado para cada um dos 12 grupos",
      rows:[
        { pts:5, icon:"🥇", label:"Acertou a posição exata", desc:"Marcou o time certo no 1º ou no 2º lugar" },
        { pts:2, icon:"🎖️", label:"Acertou entre os dois primeiros", desc:"O time passou, mas na posição errada" },
        { pts:0, icon:"❌", label:"Time não classificou", desc:"O time não ficou entre os dois primeiros" },
      ],
      note:"Pontuação independente para 1º e 2º de cada grupo. Máximo de 10pts por grupo (5+5)."
    },
    { emoji:"🏟️", title:"Mata-mata", subtitle:"Palpite de quem avança em cada fase",
      rows:[
        { pts:5,  icon:"⚔️", label:"Rodada de 32",   desc:"Acertou quem avançou" },
        { pts:10, icon:"⚔️", label:"Oitavas de final", desc:"Acertou quem avançou" },
        { pts:15, icon:"⚔️", label:"Quartas de final", desc:"Acertou quem avançou" },
        { pts:20, icon:"⚔️", label:"Semifinais",       desc:"Acertou quem avançou" },
        { pts:60, icon:"🏆", label:"Campeão",          desc:"Acertou o campeão da Copa do Mundo 2026" },
      ],
      note:"Bloqueado até o chaveamento oficial ser divulgado."
    },
  ];
  const maxPts = 3*20 + 12*10 + 16*5 + 8*10 + 4*15 + 2*20 + 60;

  return (
    <div style={{ maxWidth:560,margin:"0 auto",padding:"1.5rem 1rem" }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem" }}>
        <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",padding:0,flexShrink:0 }}>
          <i className="ti ti-arrow-left" style={{ fontSize:20,color:"var(--color-text-secondary)" }}/>
        </button>
        <div>
          <p style={{ margin:0,fontSize:12,color:"var(--color-text-secondary)" }}>Bolão do Hexa</p>
          <h2 style={{ margin:0,fontSize:18 }}>Regras de pontuação</h2>
        </div>
      </div>
      <div style={{ background:"#009c3b",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",marginBottom:"1.5rem",display:"flex",alignItems:"center",gap:14 }}>
        <span style={{ fontSize:32 }}>🏆</span>
        <div>
          <p style={{ margin:"0 0 2px",fontSize:13,color:"rgba(255,255,255,0.8)" }}>Pontuação máxima possível</p>
          <p style={{ margin:0,fontSize:24,fontWeight:500,color:"#fff" }}>{maxPts} pontos</p>
        </div>
      </div>
      {sections.map((s,si)=>(
        <div key={si} style={{ marginBottom:"1.5rem" }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
            <span style={{ fontSize:20 }}>{s.emoji}</span>
            <div>
              <p style={{ margin:0,fontWeight:500,fontSize:15 }}>{s.title}</p>
              <p style={{ margin:0,fontSize:12,color:"var(--color-text-secondary)" }}>{s.subtitle}</p>
            </div>
          </div>
          <div style={{ background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",overflow:"hidden" }}>
            {s.rows.map((row,ri)=>(
              <div key={ri} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderTop:ri>0?"0.5px solid var(--color-border-tertiary)":"none" }}>
                <div style={{ width:42,height:42,borderRadius:"var(--border-radius-md)",flexShrink:0,background:row.pts===0?"var(--color-background-secondary)":row.pts>=20?"#009c3b22":row.pts>=10?"var(--color-background-warning)":"var(--color-background-info)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
                  <span style={{ fontSize:10,fontWeight:500,color:row.pts===0?"var(--color-text-tertiary)":row.pts>=20?"#009c3b":row.pts>=10?"var(--color-text-warning)":"var(--color-text-info)" }}>{row.pts}</span>
                  <span style={{ fontSize:9,color:"var(--color-text-tertiary)",lineHeight:1 }}>pts</span>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ margin:"0 0 2px",fontSize:13,fontWeight:500 }}>{row.icon} {row.label}</p>
                  <p style={{ margin:0,fontSize:12,color:"var(--color-text-secondary)" }}>{row.desc}</p>
                </div>
              </div>
            ))}
          </div>
          {s.note&&<p style={{ margin:"8px 0 0",fontSize:12,color:"var(--color-text-secondary)",padding:"0 4px" }}>ℹ️ {s.note}</p>}
        </div>
      ))}
      <button onClick={onBack} style={{ width:"100%",padding:"10px",fontWeight:500 }}>
        <i className="ti ti-arrow-left"/> Voltar ao início
      </button>
    </div>
  );
}
