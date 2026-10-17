# Solemtrix — Pitch pentru juriu

> Durată țintă: **~4 minute** de vorbit, plus **~1 minut** de demo live. După aceea urmează întrebările juriului (3 persoane).
> Textul pentru vorbit e scris la persoana I plural. Ce e între `[paranteze drepte]` sunt indicații de scenă, nu se citesc.

---

## 1. Scriptul

### Deschiderea (0:00 – 0:40)

Bună ziua. Noi suntem **Solemtrix** și am construit, probabil, una dintre cele mai complete soluții pentru persoanele nevăzătoare. Am pus-o în obiectul pe care ei îl folosesc deja în fiecare zi: **bastonul alb**.

Mulți dintre dumneavoastră știți de **.lumen**, startup-ul românesc care a strâns **peste 14 milioane de euro** din fonduri europene, de la investitori și prin crowdfunding pentru ochelari inteligenți destinați nevăzătorilor. E o tehnologie impresionantă, dar o pereche costă **aproape 10.000 de euro**.

`[pauză]`

Noi credem că problema nu e lipsa tehnologiei. Problema e că tehnologia nu ajunge la oameni.

### Problema (0:40 – 1:30)

Vedem trei bariere.

**Prima e prețul.** Chiar dacă statul decontează dispozitivul, bugetul rămâne limitat. Cu banii pentru **o singură pereche de ochelari**, putem echipa **peste 60 de oameni** cu bastonul nostru. Pentru orice casă de asigurări, minister sau ONG, asta înseamnă de 60 de ori mai mulți oameni ajutați cu același buget.

**A doua e obișnuința.** Majoritatea persoanelor nevăzătoare folosesc bastonul alb de zeci de ani. Le-ai cere să-l înlocuiască cu un dispozitiv purtat pe cap, cu o curbă de învățare nouă, iar mulți dintre ei sunt vârstnici. Aceasta e o schimbare de comportament uriașă. Noi nu le cerem să renunțe la nimic.

**A treia e izolarea.** Familia nu știe unde e persoana, dacă a ajuns unde trebuia sau dacă are nevoie de ajutor.

`[pauză]`

Așa că ne-am pus întrebarea pe dos: **în loc să înlocuim bastonul, de ce să nu-l facem inteligent?**

### Soluția (1:30 – 3:00)

Solemtrix are trei piloni: **simte, vede și conectează**.

**1. Simte: obstacole prin vibrații.**
Bastonul are **trei senzori ultrasonici**, pe față, stânga și dreapta, plus **patru motoare de vibrație** în mâner. Un obstacol pe stânga se simte ca o vibrație pe stânga. Dacă obstacolele sunt din toate părțile, la sub 30 de centimetri, intră o alertă critică separată. Utilizatorul nu trebuie să învețe nimic nou: îl simte direct în mână.

**2. Vede: o cameră cu inteligență artificială.**
Pe baston avem o cameră, iar inteligența artificială din spatele ei:
- **recunoaște persoanele cunoscute** și îi spune la ureche, în română: *„Miroslav e în fața ta”*;
- **citește text**, adică afișe, etichete și indicatoare, și face un rezumat;
- **descrie scena** din fața utilizatorului;
- **detectează autobuzul** care vine în stație.

Vocea iese printr-un difuzor Bluetooth integrat în baston.

Esențial: **creierul nu e în baston.** Bastonul are doar senzori, cameră și motoare ieftine, iar procesarea AI se face pe server. Așa ținem prețul hardware-ului jos, iar bastonul primește funcții noi fără să fie schimbat.

**3. Conectează: o aplicație pentru două tipuri de utilizatori.**
- **Pentru persoana nevăzătoare** am făcut o interfață gândită pentru cineva care nu vede ecranul. Pornește cu un cuvânt de activare și cu **comenzi vocale în română**: *„Du-mă la farmacie”*, *„Unde sunt?”*, *„Oprește navigarea”*. Orice buton funcționează cu dublă atingere: prima atingere spune ce face butonul, a doua îl confirmă, cu feedback prin vibrații. Aplicația calculează ruta pe jos și o anunță vocal.
- **Pentru aparținător** există o hartă cu locația persoanei și o alertă dacă bastonul nu mai trimite date de 5 minute. Aparținătorul poate adăuga destinații, de exemplu *„Acasă”*, *„Policlinica”* sau *„Piața”*, iar persoana nevăzătoare le alege apoi cu vocea.

Am început să lucrăm și la **navigarea în interior**: am scanat 3D o clădire și o putem vizualiza cu traseu și obstacole marcate pe ea.

### Demo live (3:00 – 4:00)

`[Vezi secțiunea 2 pentru ordinea exactă.]`

### Modelul de business și închiderea (4:00 – 4:40)

Ținta noastră de preț este **150 de euro** pentru baston, adică același obiect pe care îl folosesc azi, plus inteligență. La prețul ăsta intră pe lista dispozitivelor asistive compensate și poate fi cumpărat în volum de ONG-uri și de autorități.

Pe scurt: **.lumen a construit un dispozitiv de 10.000 de euro pentru câțiva oameni. Noi vrem să facem unul de 150 de euro pentru toți ceilalți.**

Vă mulțumim. Suntem Solemtrix și abia așteptăm întrebările dumneavoastră.

---

## 2. Demo live — ordinea recomandată

Pregătește totul **înainte** să intri. Fiecare pas ar trebui să ia 10–15 secunde.

| # | Ce arăți | Ce spui | Pregătire |
|---|---|---|---|
| 1 | Pui mâna în fața senzorului din față, apoi a celui din stânga, și motorul corespunzător vibrează | „Obstacol în față… obstacol pe stânga.” | ESP32 pornit, backend-ul ESP rulând, haptic activat (`POST /haptic/enable`). **Ține mâna 3 secunde**: bucla verifică distanța doar la 2,5 s. |
| 2 | Un coleg cu poza în `known_faces/` intră în cadru, iar bastonul spune *„… e în fața ta”* | „Recunoaște persoanele apropiate.” | Boxa Bluetooth conectată ca ieșire audio pe Mac și o lumină bună în sală. |
| 3 | Pe telefon, ca utilizator nevăzător: *„Alexa, du-mă la farmacie”*, apoi aplicația anunță ruta | „Navigare doar cu vocea, fără să vadă ecranul.” | Destinația „Farmacie” creată din contul de aparținător și cheia Picovoice setată. |
| 4 | Pe laptop, contul de aparținător: harta cu bastonul | „Familia vede unde e.” | **Pornește `/simulator` înainte** (vezi mai jos de ce). |
| 5 | (opțional) Harta 3D de interior | „Următorul pas: navigare în interior.” | Pagina `/indoor-map` deja încărcată, pentru că modelul are 16 MB. |

**Dacă ceva pică:** ai pregătit un video de rezervă de 30 de secunde cu pașii 1 și 2.

---

## 3. Ce poți spune și ce nu ⚠️

Juriile de hackathon pun întrebări tehnice și pierzi credibilitate mai repede pe o afirmație falsă decât pe o funcție lipsă. Mai jos e ce **există efectiv în cod** acum.

### ✅ Poți spune fără grijă
- 3 senzori ultrasonici și 4 motoare de vibrație direcționale, inclusiv alerta critică.
- Recunoaștere facială cu anunț vocal în română prin difuzorul bastonului.
- OCR cu rezumat GPT, descrierea scenei și detecția autobuzului: funcționează ca demo-uri AI.
- Aplicația cu 3 roluri (admin, aparținător, nevăzător) și interfața accesibilă: cuvânt de activare, comenzi vocale în română, dublă atingere, voce ElevenLabs.
- Destinații gestionate de aparținător și calculul rutei pe jos.
- Vizualizarea unei scanări 3D de interior.

### ⚠️ Formulează cu grijă
| Afirmație | Realitatea din cod | Cum o spui corect |
|---|---|---|
| „Urmărire GPS în timp real” | Bastonul **nu are modul GPS**. Locația din demo vine din `/simulator`. | „Aplicația primește locația bastonului; în prototip o simulăm, iar în versiunea finală vine de la telefonul utilizatorului sau de la un modul GPS.” |
| „Aplicația e conectată la baston” | Aplicația web și hardware-ul **nu comunică încă**. | „Am construit cele două componente în paralel; integrarea e următorul pas.” |
| „Bastonul citește textul cu voce tare” | Rezumatul OCR și descrierea scenei apar **doar pe ecranul Mac-ului**, nu sunt rostite. | Spune „citește” și „descrie”. Dacă ai timp înainte de pitch, leagă `gpt_engine` de `tts.speak`: e o modificare mică și face demo-ul mult mai puternic. |
| „Navigare pas cu pas” | E o **prezentare a rutei** (distanță și timp estimat), fără instrucțiuni la fiecare intersecție. | „Calculează ruta și o anunță vocal.” |
| „Reacție instantanee la obstacole” | Bucla haptică verifică distanța la **2,5 secunde**. | Nu da cifre. Dacă te întreabă: „În prototip sondăm rar din cauza WiFi-ului; în produs logica merge direct pe ESP32, fără latență de rețea.” |
| „Măsoară calitatea aerului, temperatura etc.” | Senzorii sunt citiți, dar **nimic nu îi folosește**. | Nu-i menționa în pitch. Ține-i pentru întrebări, ca bază pentru funcții viitoare. |
| „Merge fără laptop” | AI-ul rulează pe un **Mac din aceeași rețea WiFi**. | „Procesarea AI e pe server; în produs, rolul acesta îl preia telefonul și cloud-ul.” |
| „150 de euro” | **Nu există un buget de componente (BOM) în repo.** | Fă calculul de mai jos înainte de pitch și spune „țintă” sau „estimat”. |

---

## 4. Calculul de cost (de verificat!)

Juriul **va întreba** de unde vin cei 150 de euro. Mai jos e o estimare orientativă cu prețuri de retail pentru componente. **Înlocuiește-o cu prețurile reale pe care le-ați plătit.**

| Componentă | Estimare |
|---|---|
| ESP32 DevKit | ~8 € |
| ESP32-CAM (AI Thinker) | ~8 € |
| 3× HC-SR04 | ~6 € |
| 4× motor de vibrație + MOSFET-uri | ~6 € |
| Amplificator PAM8403 + difuzor | ~4 € |
| Baterie Li-ion + modul de încărcare | ~10 € |
| Carcasă de mâner (print 3D) + cablaj | ~10 € |
| Baston alb pliabil | ~20 € |
| **Total componente** | **~70 €** |

Astfel, 150 € înseamnă ~70 € componente plus asamblare, garanție și marjă. Mai rămâne de lămurit **costul AI per utilizator** (OpenAI și ElevenLabs), pe care îl puteți acoperi printr-un abonament opțional pentru funcțiile AI sau prin modele care rulează local pe telefon.

---

## 5. Întrebări probabile de la juriu

**„De ce nu doar o aplicație pe telefon?”**
Pentru că telefonul ține ocupată o mână, iar cealaltă ține bastonul. Bastonul e deja în mână, iar vibrația direcțională în mâner e mai rapidă și mai discretă decât orice notificare de pe telefon.

**„Există deja bastoane inteligente, de exemplu WeWALK.”**
Da, și le respectăm. Dar WeWALK costă **între ~600 și ~850 de lire**, iar asistentul AI vine cu abonament anual. Noi țintim **150 de euro** și avem pe lângă ce oferă ei recunoaștere facială și o aplicație pentru aparținător.

**„.lumen spune că în România dispozitivul va fi decontat integral.”**
*(Fondatorul .lumen chiar a declarat asta, așa că fii pregătit.)* Chiar dacă e decontat, cineva tot plătește 10.000 de euro. Același buget echipează peste 60 de oameni cu Solemtrix. Nu concurăm cu .lumen pe tehnologie, concurăm pe **acces**.

**„Ce se întâmplă fără internet?”**
Detecția obstacolelor și vibrațiile nu au nevoie de cloud. În produsul final, logica rulează direct pe ESP32. Funcțiile AI cer conexiune; recunoașterea facială poate rula local.

**„Cât ține bateria?”**
*Măsurați înainte!* Dacă nu ați măsurat, spuneți cinstit: „Nu am măsurat încă pe prototip; ținta noastră e o zi întreagă de folosire.”

**„Ați testat cu persoane nevăzătoare?”**
*Dacă nu:* „Încă nu. Primul pas după hackathon e un pilot cu [o asociație locală / UNNR].” Juriul apreciază un răspuns cinstit plus un plan concret.

**„Care e următorul pas?”**
1. Integrarea bastonului cu aplicația: locația și evenimentele de pe baston ajung la aparținător.
2. Logica de obstacole direct pe ESP32, pentru reacție instantanee.
3. Un pilot cu utilizatori reali.
4. Înscrierea pe lista de dispozitive asistive compensate.

---

## 6. Sfaturi de livrare

- **Spune „persoane nevăzătoare”**, nu „orbi” și nici „asistați sociali”. Dacă în juriu e cineva din domeniu, contează.
- **Nu ataca .lumen.** Formula *„e o tehnologie impresionantă, dar…”* te face să pari matur. Juriul poate avea legături cu ei.
- **Cifra de ținut minte:** *1 pereche de ochelari = 60+ bastoane Solemtrix.* Repet-o la final.
- **Demo-ul bate slide-urile.** Dacă rămâi fără timp, taie din secțiunea „Soluția”, nu din demo.
- **Împărțiți rolurile:** unul vorbește, altul face demo-ul. Nimeni nu scrie la tastatură în timp ce vorbește.

---

### Surse pentru cifrele din pitch

- .lumen, finanțare EIC de 9,7 mil. € — [Romania Insider](https://www.romania-insider.com/dot-lumen-seedblink-round-jul-2024)
- .lumen, rundă de 5 mil. € în 2024 (EIC, Venture to Future Fund și 1 mil. € prin crowdfunding pe SeedBlink) — [Vestbee](https://www.vestbee.com/blog/articles/dot-lumen-secures-5-m), [EIC Scaling Club](https://eicscalingclub.eu/news/dotlumen-raises-5-million)
- Prețul ochelarilor .lumen: **9.999 €** la rezervare — [New Atlas](https://newatlas.com/wearables/dotlumen-ai-glasses-blind-independence/); interval 5.000–10.000 € și planul de decontare în România — [AIN interview, feb. 2025](https://en.ain.ua/2025/02/20/interview-with-lumen/)
- Prețul WeWALK Smart Cane 2: 599–849 £ fără TVA — [Sight & Sound](https://www.sightandsound.co.uk/product/wewalk/), [RNIB](https://shop.rnib.org.uk/products/wewalk-smart-cane-2-ai)
