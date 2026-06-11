# Bolão do Hexa — Vencerás ou Mamarás?

## Deploy

### 1. Firestore Rules
No Firebase Console → **Firestore → Rules**:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /participants/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    match /admin/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### 2. Push
```bash
git init
git add .
git commit -m "bolão do hexa"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/bolao-hexa.git
git push -u origin main
```

### 3. Ativar GitHub Pages
Settings → Pages → Source → **GitHub Actions**

Site: `https://SEU_USUARIO.github.io/bolao-hexa/`

### Senha do admin
`copa2026admin`
