// ===========================================
// Firebase Integration: Auth & Firestore Imports
// ===========================================
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
  orderBy,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

import { getApps } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";

// Use the already-initialized Firebase app from index.html
const app = getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

// ===========================================
// Chat App Code (Authentication & Chat)
// ===========================================
document.addEventListener("DOMContentLoaded", () => {
  let currentUser = null;
  let currentConversationId = null;
  let messagesUnsub = null;

  // --- DOM Elements ---
  const authContainer = document.getElementById("authContainer");
  const loginFormContainer = document.getElementById("loginFormContainer");
  const signupFormContainer = document.getElementById("signupFormContainer");
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const chatSection = document.getElementById("chatSection");
  const logoutBtn = document.getElementById("logout-btn");
  const conversationListEl = document.getElementById("conversationList");
  const conversationTitleEl = document.getElementById("conversationTitle");
  const chatMessages = document.getElementById("chatMessages");
  const sendButton = document.getElementById("sendButton");
  const messageInput = document.getElementById("messageInput");
  const imageUploadBtn = document.getElementById("imageUploadBtn");
  const imageInput = document.getElementById("imageInput");
  const videoUploadBtn = document.getElementById("videoUploadBtn");
  const videoInput = document.getElementById("videoInput");
  const documentUploadBtn = document.getElementById("documentUploadBtn");
  const documentInput = document.getElementById("documentInput");
  const newChatBtn = document.getElementById("newChatBtn");
  const newGroupBtn = document.getElementById("newGroupBtn");
  const userSearch = document.getElementById("userSearch");
  const adminControls = document.getElementById("adminControls");
  const addMemberBtn = document.getElementById("addMemberBtn");
  const removeMemberBtn = document.getElementById("removeMemberBtn");
  const statusSidebarBtn = document.getElementById("statusSidebarBtn");
  const statusContainer = document.getElementById("statusContainer");
  const statusList = document.getElementById("statusList");
  const addStatusBtn = document.getElementById("addStatusBtn");
  const statusInput = document.getElementById("statusInput");
  const chatInputArea = document.getElementById("chatInputArea");

  // --- LocalStorage Keys ---
  const CONVERSATIONS_KEY = "conversations";
  function getConversations() {
    return JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || "{}");
  }
  function saveConversations(convos) {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(convos));
  }

  // ----------------- UI Display Functions -----------------
  function showAuth() {
    chatSection.style.display = "none";
    authContainer.style.display = "block";
  }
  function showChat() {
    authContainer.style.display = "none";
    chatSection.style.display = "flex";
    updateConversationList();
  }

  // ----------------- Firebase Auth State Listener -----------------
  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      showChat();
    } else {
      currentUser = null;
      showAuth();
    }
  });

  // ----------------- Tab Switching -----------------
  loginTab.addEventListener("click", () => {
    loginTab.classList.add("active");
    signupTab.classList.remove("active");
    loginFormContainer.style.display = "block";
    signupFormContainer.style.display = "none";
  });
  signupTab.addEventListener("click", () => {
    signupTab.classList.add("active");
    loginTab.classList.remove("active");
    signupFormContainer.style.display = "block";
    loginFormContainer.style.display = "none";
  });

  // ----------------- Email/Password Login -----------------
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    if (email && password) {
      signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
          currentUser = userCredential.user;
          showChat();
        })
        .catch((error) => {
          alert("Login failed: " + error.message);
        });
    }
  });

  // ----------------- Email/Password Sign Up -----------------
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signupUsername").value.trim();
    const password = document.getElementById("signupPassword").value.trim();
    if (email && password) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await setDoc(doc(db, "users", user.uid), { email: user.email });
        currentUser = user;
        showChat();
      } catch (error) {
        alert("Sign Up failed: " + error.message);
      }
    }
  });

  // ----------------- Social Login -----------------
  document.querySelectorAll(".social-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const providerName = btn.getAttribute("data-provider");
      let provider;
      if (providerName === "Google") {
        provider = new GoogleAuthProvider();
      } else if (providerName === "Facebook") {
        provider = new FacebookAuthProvider();
      } else if (providerName === "Twitter") {
        provider = new TwitterAuthProvider();
      } else if (providerName === "Phone") {
        alert("Phone authentication is not implemented in this demo.");
        return;
      }
      try {
        const result = await signInWithPopup(auth, provider);
        currentUser = result.user;
        await setDoc(doc(db, "users", currentUser.uid), { email: currentUser.email }, { merge: true });
        showChat();
      } catch (error) {
        alert("Social login failed: " + error.message);
      }
    });
  });

  // ----------------- Logout -----------------
  logoutBtn.addEventListener("click", async () => {
    try {
      await auth.signOut();
      currentUser = null;
      currentConversationId = null;
      showAuth();
    } catch (error) {
      alert("Logout failed: " + error.message);
    }
  });

  // ----------------- New Chat -----------------
  newChatBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    let targetUser = prompt("Enter the email of the user to chat with:");
    if (!targetUser) return;
    targetUser = targetUser.trim().toLowerCase();
    const currentIdentifier = currentUser.email.toLowerCase();
    if (targetUser === currentIdentifier) {
      alert("You cannot chat with yourself.");
      return;
    }
    const usersRef = collection(db, "users");
    const qUsers = query(usersRef, where("email", "==", targetUser));
    const userSnap = await getDocs(qUsers);
    if (userSnap.empty) {
      alert("User not found.");
      return;
    }
    const convosRef = collection(db, "conversations");
    const convosQuery = query(convosRef, where("isGroup", "==", false));
    let found = false;
    let convoId = null;
    const convosSnap = await getDocs(convosQuery);
    convosSnap.forEach(docSnap => {
      const c = docSnap.data();
      if (c.participants.length === 2 &&
          c.participants.includes(currentUser.email) &&
          c.participants.includes(targetUser)) {
        found = true;
        convoId = docSnap.id;
      }
    });
    if (!found) {
      const newConvo = {
        isGroup: false,
        participants: [currentUser.email.toLowerCase(), targetUser],
        createdAt: Date.now()
      };
      const docRef = await addDoc(convosRef, newConvo);
      convoId = docRef.id;
    }
    currentConversationId = convoId;
    conversationTitleEl.textContent = targetUser;
    loadMessages(convoId);
  });

  // ----------------- New Group Chat -----------------
  newGroupBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    let groupName = prompt("Enter a group chat name:");
    if (!groupName) return;
    let usersInput = prompt("Enter emails to add (comma separated):");
    if (!usersInput) return;
    const currentIdentifier = currentUser.email.toLowerCase();
    let participants = usersInput.split(",")
      .map(u => u.trim().toLowerCase())
      .filter(u => u && u !== currentIdentifier);
    let validParticipants = [];
    for (let email of participants) {
      const qUsers = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(qUsers);
      if (!snap.empty) {
        validParticipants.push(email);
      }
    }
    if (validParticipants.length === 0) {
      alert("No valid participants found.");
      return;
    }
    validParticipants.push(currentUser.email.toLowerCase());
    const convosRef = collection(db, "conversations");
    const newGroup = {
      isGroup: true,
      title: groupName,
      participants: validParticipants,
      admin: currentUser.email.toLowerCase(),
      createdAt: Date.now()
    };
    const docRef = await addDoc(convosRef, newGroup);
    currentConversationId = docRef.id;
    conversationTitleEl.textContent = groupName;
    loadMessages(docRef.id);
  });

  // ----------------- Sending Text Messages -----------------
  sendButton.addEventListener("click", async () => {
    console.log("Send button clicked, currentConversationId:", currentConversationId);
    if (!currentConversationId || !currentUser) return;
    const text = messageInput.value.trim();
    if (!text) return;
    const message = {
      sender: currentUser.email,
      type: "text",
      content: text,
      timestamp: Date.now()
    };
    await addDoc(collection(db, "conversations", currentConversationId, "messages"), message);
    messageInput.value = "";
  });
  messageInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") sendButton.click();
  });

  // ----------------- Sending Image Messages -----------------
  imageUploadBtn.addEventListener("click", () => {
    if (!currentConversationId || !currentUser) return;
    imageInput.click();
  });
  imageInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0] && currentConversationId) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async function(ev) {
        const message = {
          sender: currentUser.email,
          type: "image",
          content: ev.target.result,
          timestamp: Date.now()
        };
        await addDoc(collection(db, "conversations", currentConversationId, "messages"), message);
      };
      reader.readAsDataURL(file);
      imageInput.value = "";
    }
  });

  // ----------------- Sending Video Messages -----------------
  videoUploadBtn.addEventListener("click", () => {
    if (!currentConversationId || !currentUser) return;
    videoInput.click();
  });
  videoInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0] && currentConversationId) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async function(ev) {
        const message = {
          sender: currentUser.email,
          type: "video",
          content: ev.target.result,
          timestamp: Date.now()
        };
        await addDoc(collection(db, "conversations", currentConversationId, "messages"), message);
      };
      reader.readAsDataURL(file);
      videoInput.value = "";
    }
  });

  // ----------------- Sending Document Messages -----------------
  documentUploadBtn.addEventListener("click", () => {
    if (!currentConversationId || !currentUser) return;
    documentInput.click();
  });
  documentInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0] && currentConversationId) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async function(ev) {
        const message = {
          sender: currentUser.email,
          type: "document",
          content: ev.target.result,
          timestamp: Date.now()
        };
        await addDoc(collection(db, "conversations", currentConversationId, "messages"), message);
      };
      reader.readAsDataURL(file);
      documentInput.value = "";
    }
  });

  // ----------------- Searching Users -----------------
  userSearch.addEventListener("input", async () => {
    const queryValue = userSearch.value.trim().toLowerCase();
    if (!queryValue) {
      loadConversations();
      return;
    }
    const usersRef = collection(db, "users");
    const allSnap = await getDocs(usersRef);
    conversationListEl.innerHTML = "";
    allSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.email.toLowerCase().includes(queryValue) &&
          data.email.toLowerCase() !== currentUser.email.toLowerCase()) {
        const div = document.createElement("div");
        div.classList.add("conversation-item");
        div.textContent = data.email;
        div.addEventListener("click", async () => {
          const convosRef = collection(db, "conversations");
          const convosQuery = query(convosRef, where("isGroup", "==", false));
          let found = false;
          let convoId = null;
          const convosSnap = await getDocs(convosQuery);
          convosSnap.forEach(docSnap => {
            const c = docSnap.data();
            if (c.participants.length === 2 &&
                c.participants.includes(currentUser.email.toLowerCase()) &&
                c.participants.includes(data.email.toLowerCase())) {
              found = true;
              convoId = docSnap.id;
            }
          });
          if (!found) {
            const newConvo = {
              isGroup: false,
              participants: [currentUser.email.toLowerCase(), data.email.toLowerCase()],
              createdAt: Date.now()
            };
            const docRef = await addDoc(convosRef, newConvo);
            convoId = docRef.id;
          }
          currentConversationId = convoId;
          conversationTitleEl.textContent = data.email;
          loadMessages(convoId);
        });
        conversationListEl.appendChild(div);
      }
    });
  });

  // ----------------- Listen for LocalStorage Changes -----------------
  window.addEventListener("storage", (e) => {
    if (e.key === CONVERSATIONS_KEY) {
      updateConversationList();
      if (currentConversationId) loadMessages(currentConversationId);
    }
  });

  // ===== NEW COMMANDS: Ensure a default conversation exists =====
  if (currentUser && !currentConversationId) {
    currentConversationId = "default_chat";
    let convos = getConversations();
    if (!convos[currentConversationId]) {
      convos[currentConversationId] = {
        id: currentConversationId,
        isGroup: false,
        participants: [currentUser.email.toLowerCase()],
        messages: []
      };
      saveConversations(convos);
      console.log("Default conversation created:", convos[currentConversationId]);
    }
    conversationTitleEl.textContent = "Default Chat";
    loadMessages(currentConversationId);
  }
});

// ----------------- Additional Code for Send Button and File Attachment -----------------
document.addEventListener('DOMContentLoaded', () => {
  function addMessage(content, type, isAttachment = false) {
    const chatMessages = document.getElementById('chatMessages');
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', type);

    if (!isAttachment) {
      const textEl = document.createElement('div');
      textEl.classList.add('text');
      textEl.textContent = content;
      messageEl.appendChild(textEl);
    } else {
      messageEl.appendChild(content);
    }

    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function simulateReply(message) {
    setTimeout(() => {
      addMessage("Echo: " + message, 'received');
    }, 1000);
  }

  const sendButton = document.getElementById('sendButton');
  const messageInput = document.getElementById('messageInput');
  const attachButton = document.getElementById('attachButton'); // If available
  const fileInput = document.getElementById('fileInput'); // If available

  sendButton.addEventListener('click', () => {
    console.log("Send button clicked");
    const text = messageInput.value.trim();
    if (text !== '') {
      addMessage(text, 'sent');
      messageInput.value = '';
      simulateReply(text);
    } else {
      console.log("No text to send");
    }
  });

  messageInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      sendButton.click();
    }
  });

  if (attachButton && fileInput) {
    attachButton.addEventListener('click', () => {
      fileInput.click();
    });
  
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
          let element;
          if (file.type.startsWith('image/')) {
            element = document.createElement('img');
            element.src = event.target.result;
          } else if (file.type.startsWith('video/')) {
            element = document.createElement('video');
            element.src = event.target.result;
            element.controls = true;
          }
          if (element) {
            addMessage(element, 'sent', true);
          }
        }
        reader.readAsDataURL(file);
      }
    });
  }

  // Logout (redundant if already set above)
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
  });
});
