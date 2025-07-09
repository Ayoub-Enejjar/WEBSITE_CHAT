# ChatApp-Saiyans

## Table des Matières
* [À propos du Projet](#à-propos-du-projet)
* [Fonctionnalités Clés](#fonctionnalités-clés)
* [Stack Technologique](#stack-technologique)
* [Démarrage Rapide](#démarrage-rapide)
  * [Prérequis](#prérequis)
  * [Installation](#installation)
  * [Configuration des Variables d'Environnement](#configuration-des-variables-denvironnement)
  * [Lancement de l'Application](#lancement-de-lapplication)
* [Structure du Projet](#structure-du-projet)
* [Aperçu Détaillé du Code](#aperçu-détaillé-du-code)
  * [Serveur (server/server.js)](#serveur-serverserverjs)
  * [Base de Données (server/database.js & server/models/)](#base-de-données-serverdatabasejs--servermodels)
  * [Client HTML (client/index.html)](#client-html-clientindexhtml)
  * [Client CSS (client/css/style.css)](#client-css-clientcssstylecss)
  * [Client JavaScript (client/js/client.js)](#client-javascript-clientjsclientjs)
* [Contribuer](#contribuer)
* [Licence](#licence)
* [Contact](#contact)

---

## À propos du Projet

**ChatApp-Saiyans** est une application web de messagerie instantanée en temps réel, développée pour illustrer l'utilisation de **Node.js**, **Express**, **Socket.IO** et **MongoDB** afin de construire des outils de communication interactifs et dynamiques. Elle permet à de multiples utilisateurs de se connecter simultanément, de personnaliser leur profil avec un "Saiyan ID" unique et un avatar, d'échanger des messages (texte, fichiers, audio) qui s'affichent instantanément, et de gérer leurs interactions.

L'application se distingue par une interface utilisateur soignée, inspirée des standards modernes des applications de messagerie, et offre une personnalisation avancée grâce à plusieurs thèmes (Clair, Sombre, et un mode "Saiyan" distinctif), dont la préférence est sauvegardée via `localStorage`. Le projet met en exergue des concepts fondamentaux tels que :
*   Communication WebSocket pour une interactivité en temps réel.
*   Gestion d'état robuste côté serveur (suivi des utilisateurs, gestion des sessions).
*   Manipulation dynamique du DOM et gestion événementielle côté client.
*   Pratiques de sécurité de base, incluant la sanitisation des entrées.
*   Persistance des données utilisateur et des messages grâce à une base de données MongoDB.
*   Partage de médias enrichi (fichiers et messages audio).

---

## Fonctionnalités Clés

*   ✅ **Messagerie en Temps Réel :** Livraison instantanée des messages texte, fichiers et audio grâce à Socket.IO.
*   👤 **Profils Utilisateurs Complets :** Inscription avec nom d'utilisateur, mot de passe, "Saiyan ID" unique et photo de profil personnalisable.
*   💬 **Messagerie Privée :** Conversations directes et sécurisées entre deux utilisateurs.
*   🔍 **Recherche d'Utilisateurs :** Localisation facile d'autres Saiyans par leur "Saiyan ID" unique.
*   📎 **Partage de Fichiers :** Téléversement et affichage de divers types de fichiers (images, documents) directement dans les fils de discussion.
*   🎤 **Messages Audio :** Enregistrement et envoi de messages vocaux pour une communication plus expressive.
*   🎨 **Thèmes Multiples & Personnalisables :** Choix entre les thèmes Clair, Sombre et Saiyan, avec sauvegarde des préférences.
*   🖼️ **Personnalisation de l'Arrière-plan :** Sélection d'images de fond pour la zone de chat.
*   📱 **Interface Réactive :** Conception adaptative assurant une expérience utilisateur optimale sur ordinateurs et appareils mobiles.
*   🛡️ **Validation & Sanitisation :** Vérifications des entrées côté client et serveur, et échappement HTML pour prévenir les risques XSS.
*   🌐 **Gestion de l'État de Connexion :** Indicateurs visuels pour l'état de la connexion et gestion automatique des reconnexions.

---

## Stack Technologique

La puissance de ChatApp-Saiyans repose sur une combinaison de technologies modernes et éprouvées :

*   **Backend :**
  *   **Runtime :** Node.js (v16+ recommandée)
  *   **Framework Serveur :** Express.js
  *   **Communication Temps Réel :** Socket.IO (Bibliothèque Serveur)
  *   **Base de Données :** MongoDB (utilisant le driver `mongodb` natif)
  *   **Gestion des Sessions :** `express-session`
  *   **Sécurité des Mots de Passe :** `bcrypt`
  *   **Gestion des Téléversements :** `multer`
  *   **Configuration :** `dotenv` pour les variables d'environnement
  *   **Modules Node.js Utilitaires :** `fs`, `path`, `uuid`

*   **Frontend :**
  *   **Structure :** HTML5 (`client/index.html`)
  *   **Styling :** CSS3 (`client/css/style.css`)
    *   Variables CSS pour une thématisation flexible.
    *   Design réactif avec `@media queries`.
  *   **Logique Client :** Vanilla JavaScript (ES6+) (`client/js/client.js`)
    *   Manipulation du DOM, gestion des événements.
    *   `localStorage` pour la persistance des préférences.
  *   **Communication Temps Réel :** Socket.IO (Bibliothèque Client)
  *   **Icônes :** Font Awesome (via CDN)

*   **Outils de Développement :**
  *   **Gestionnaire de Paquets :** npm (pour les dépendances serveur)
  *   **Live Reload :** Nodemon (pour le redémarrage automatique du serveur)

---

## Démarrage Rapide

Suivez ces étapes pour mettre en place et exécuter ChatApp-Saiyans sur votre machine locale.

### Prérequis

Avant de commencer, assurez-vous d'avoir installé les éléments suivants :

*   **Node.js :** Version 16.x ou une version ultérieure. Vous pouvez le télécharger depuis [nodejs.org](https://nodejs.org/).
*   **npm :** Node Package Manager, qui est inclus avec l'installation de Node.js.
*   **MongoDB :** Une instance de base de données MongoDB accessible.
  *   Nous recommandons [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) pour un cluster cloud gratuit et facile à gérer.
  *   **Crucial :** N'oubliez pas d'ajouter votre adresse IP actuelle à la "IP Access List" dans les paramètres de sécurité réseau de votre cluster MongoDB Atlas.

### Installation

1.  **Clonez le dépôt de ChatApp-Saiyans :**
    ```bash
    git clone <votre_url_repository> ChatApp-Saiyans
    cd ChatApp-Saiyans
    ```
    *(Remplacez `<votre_url_repository>` par l'URL effective de votre dépôt Git).*

2.  **Installez les dépendances du serveur :**
    Le serveur Node.js nécessite plusieurs paquets pour fonctionner. Naviguez dans le dossier `server` et exécutez :
    ```bash
    cd server
    npm install
    ```

### Configuration des Variables d'Environnement

L'application utilise un fichier `.env` pour stocker des configurations sensibles comme les identifiants de base de données.

1.  **Créez le fichier `.env` :**
    À la racine du dossier `server`, créez un nouveau fichier nommé `.env`.

2.  **Remplissez le fichier `.env` :**
    Copiez le contenu ci-dessous dans `server/.env` et remplacez les placeholders par vos informations :
    ```dotenv
    # Configuration MongoDB
    MONGODB_URI="mongodb+srv://<VOTRE_UTILISATEUR_ATLAS>:<VOTRE_MOT_DE_PASSE_ATLAS>@<VOTRE_CLUSTER_URL>/chatapp?retryWrites=true&w=majority"

    # Secret pour la session Express
    SESSION_SECRET="CHOISISSEZ_UNE_PHRASE_SECRETE_LONGUE_COMPLEXE_ET_UNIQUE_POUR_LA_SECURITE_DES_SESSIONS"

    # Port du serveur
    PORT=3001
    ```
  *   **`MONGODB_URI`**: Votre chaîne de connexion MongoDB Atlas complète. Assurez-vous que le nom de la base de données (ici `chatapp`) est correct.
  *   **`SESSION_SECRET`**: Une chaîne aléatoire et robuste pour la signature des cookies de session.
  *   **`PORT`**: Le port sur lequel le serveur écoutera.

### Lancement de l'Application

1.  **Démarrez le serveur Node.js :**
    Depuis le répertoire `server/`, exécutez la commande suivante :
    ```bash
    npm run dev
    ```
    *(Ce script utilise `nodemon` pour le développement, qui redémarre le serveur automatiquement lors des modifications de code. Pour une exécution standard, utilisez `npm start`).*

2.  **Vérifiez les logs du serveur :**
    Le terminal devrait afficher des messages indiquant que le serveur a démarré avec succès et s'est connecté à MongoDB :
    ```
    🚀 Server is running on port 3001
    🌐 Access the application at: http://localhost:3001
    ✅ Connected to MongoDB database: chatapp
    ...
    ```

3.  **Accédez à ChatApp-Saiyans dans votre navigateur :**
    Ouvrez votre navigateur web préféré et rendez-vous à l'adresse : `http://localhost:3001` (ou le port que vous avez configuré).

4.  **Commencez à chatter !**
    L'interface d'authentification devrait apparaître. Inscrivez-vous ou connectez-vous. Pour tester les fonctionnalités multi-utilisateurs, ouvrez l'application dans un autre onglet ou une fenêtre de navigation privée.

---
## Structure du Projet

L'organisation des fichiers du projet est la suivante :
ChatApp-main/     
├── client/ # Contient les fichiers front-end (HTML, CSS, JS client)    
│ ├── assets/ # Images, icônes, etc.  
│ ├── css/  
│ │ ├── style.css  
│ │ └── file-attachments.css  
│ ├── js/  
│ │ └── client.js # Logique JavaScript principale du client  
│ ├── uploads/ # Dossier (créé par le serveur) pour les fichiers téléversés  
│ └── index.html # Page principale de l'application  
├── server/ # Contient les fichiers back-end (logique serveur Node.js)  
│ ├── models/ # Modèles de données pour MongoDB  
│ │ ├── User.js  
│ │ └── Message.js  
│ ├── .env # (À créer) Variables d'environnement  
│ ├── database.js # Configuration et initialisation de la base de données MongoDB  
│ ├── package.json # Dépendances et scripts du serveur  
│ ├── package-lock.json  
│ └── server.js # Fichier principal du serveur Express et Socket.IO  
├── .gitignore # Fichiers et dossiers à ignorer par Git  
├── README.md # Ce fichier  
└── test_connection.js # Script pour tester la connexion MongoDB   


---
## Aperçu Détaillé du Code

### Serveur (`server/server.js`)
Ce fichier est le cœur du backend. Il met en place un serveur Node.js utilisant Express et Socket.IO pour gérer les communications en temps réel et les requêtes HTTP.
*   **Service de fichiers statiques :** Sert les fichiers du dossier `client/` (HTML, CSS, JS).
*   **Gestion des sessions :** Utilise `express-session` pour maintenir l'état de connexion des utilisateurs.
*   **Socket.IO :** Gère les connexions WebSocket, la réception et l'émission d'événements de chat (nouveaux messages, recherche d'utilisateurs, notifications).
*   **Routes API :** Définit des points de terminaison pour l'authentification (`/api/register`, `/api/login`, `/api/logout`), la récupération des messages et conversations (`/api/messages`, `/api/conversations`), et la mise à jour des profils.
*   **Gestion des téléversements :** Utilise `multer` pour traiter les fichiers envoyés (photos de profil, pièces jointes, messages audio) et les stocker dans `client/uploads/`.
*   **Suivi des utilisateurs actifs :** Maintient une liste des utilisateurs actuellement connectés.

### Base de Données (`server/database.js` & `server/models/`)
Gère la persistance des données avec MongoDB.
*   `database.js` : Établit la connexion à l'instance MongoDB en utilisant la chaîne de connexion fournie dans `.env`. Exporte l'objet `db` pour une utilisation par les modèles.
*   `models/User.js` : Structure les données utilisateur. Fournit des méthodes pour créer, rechercher (par ID, nom d'utilisateur, Saiyan ID), mettre à jour les informations (ex: photo de profil), et vérifier les mots de passe avec `bcrypt`.
*   `models/Message.js` : Structure les données des messages. Fournit des méthodes pour créer de nouveaux messages, récupérer l'historique des messages entre utilisateurs, et agréger les données pour afficher la liste des conversations récentes.

### Client HTML (`client/index.html`)
Définit la structure sémantique de l'interface utilisateur de l'application.
*   **Écrans d'Authentification :** Formulaires pour l'inscription et la connexion.
*   **Interface de Chat Principale :** Comprend une barre latérale pour les conversations et la recherche, et une zone centrale pour l'affichage des messages et la saisie.
*   **Éléments Dynamiques :** Contient des placeholders (comme des `<ul>`) qui sont remplis dynamiquement par JavaScript avec les messages, les listes d'utilisateurs et les conversations.

### Client CSS (`client/css/style.css`)
Responsable de l'apparence et de la mise en page de l'application.
*   **Thématisation :** Utilise des variables CSS pour permettre un changement facile entre les thèmes Clair, Sombre et Saiyan.
*   **Styling des Composants :** Styles pour les bulles de message, les formulaires, les boutons, la barre latérale, etc.
*   **Réactivité :** Inclut des `@media queries` pour ajuster la mise en page sur différentes tailles d'écran, assurant une bonne expérience sur mobile et bureau.
*   `file-attachments.css` : Contient des styles spécifiques pour l'affichage des pièces jointes.

### Client JavaScript (`client/js/client.js`)
Contient la logique interactive côté client.
*   **Connexion Socket.IO :** Établit et maintient la connexion WebSocket avec le serveur.
*   **Gestion de l'Interface Utilisateur (DOM) :** Met à jour dynamiquement le contenu de la page (affichage des messages, des conversations, des erreurs, etc.).
*   **Gestion des Événements :** Gère les interactions de l'utilisateur (clics sur les boutons, soumission de formulaires, saisie de texte).
*   **Communication avec le Serveur :** Envoie des événements Socket.IO (nouveaux messages, recherche d'utilisateur) et écoute les événements entrants (messages reçus, résultats de recherche, mises à jour de la liste des utilisateurs).
*   **Logique d'Authentification :** Gère l'affichage des formulaires de connexion/inscription et envoie les informations au serveur.
*   **Fonctionnalités de Chat :** Implémente l'envoi de messages texte, le téléversement de fichiers, et l'enregistrement/envoi de messages audio.
*   **Personnalisation :** Gère le changement de thème et de fond d'écran, en sauvegardant les préférences dans `localStorage`.
*   **Sanitisation des Entrées :** Utilise une fonction `escapeHtml` pour prévenir l'injection de HTML malveillant dans les messages affichés.

---

## Contribuer

Les contributions pour améliorer ChatApp-Saiyans sont grandement appréciées !

1.  **Forkez** le dépôt sur GitHub.
2.  **Créez votre branche de fonctionnalité** (`git checkout -b feature/MaSuperFonctionnalite`).
3.  **Commitez vos changements** (`git commit -m 'Ajout de MaSuperFonctionnalite'`).
4.  **Poussez vers la branche** (`git push origin feature/MaSuperFonctionnalite`).
5.  Ouvrez une **Pull Request**.

Merci de suivre les bonnes pratiques de codage et de commenter votre code lorsque c'est pertinent.

---

## Licence

Ce projet est distribué sous la licence MIT.

---

## Contact

Pour toute question, suggestion ou simplement pour dire bonjour :

*   **Nom :** ENEJJAR Ayoub, SAMID Oussama, DOUBABI Ali, FELLAH Hamza
*   **GitHub :** [@Ayoub-Enejjar](https://github.com/Ayoub-Enejjar) / [@DoubabiAli](https://github.com/DoubabiAli) / [@samidos03](https://github.com/samidos03) / [@hamzaX5](https://github.com/hamzaX5)