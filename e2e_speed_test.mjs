import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;

async function run() {
  console.log("Loading models...");
  const oracle = await pipeline('text-classification', 'onnx-community/bert-small-phishing-ONNX', { quantized: true });
  const xaiClassifier = await pipeline('zero-shot-classification', 'Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7', { quantized: true });
  console.log("Models loaded!");

  const texts = [
    {
       name: 'Bank Phishing',
       text: 'Ваш обліковий запис буде заблоковано протягом 24 годин через підозрілу активність. Щоб уникнути блокування, необхідно терміново підтвердити дані облікового запису. Перейдіть за посиланням нижче та виконайте перевірку: https://account-security-check.example/verify Якщо підтвердження не буде виконано сьогодні, доступ до облікового запису може бути обмежено.'
    },
    {
       name: 'CEO Fraud',
       text: 'Привіт, я зараз на важливій зустрічі і не можу говорити. Дуже термінова справа. Купи, будь ласка, подарункові сертифікати Apple на 1000$ і надішли мені коди. Я поверну гроші завтра.'
    }
  ];

  const hypothesisMap = {
      'вимогу негайних дій, терміновість або створення відчуття паніки': 'терміновість',
      'повідомлення від імені керівника, банку або офіційної установи': 'авторитет',
      'обіцянку виграшу, грошової винагороди або загрозу штрафу': 'фінансова маніпуляція',
      'погрозу розголошенням конфіденційної інформації або шантаж': 'шантаж та погрози',
      'прохання надати пароль, логін або переходити за підозрілим посиланням': 'викрадення даних',
      'пропозицію унікальної можливості або маніпуляцію страхом втратити вигоду': 'цікавість та fomo',
      'прохання про фінансову чи іншу допомогу через скрутну ситуацію': 'прохання про допомогу'
  };
  const candidateLabels = Object.keys(hypothesisMap);
  const classificationOptions = { multi_label: true, hypothesis_template: "Цей текст містить {}." };

  for (const t of texts) {
    console.log(`\n--- Testing: ${t.name} ---`);
    const start = Date.now();
    
    // 1. Oracle
    const oracleOutput = await oracle(t.text);
    console.log("Oracle:", oracleOutput);
    
    // 2. Sentences
    const sentences = t.text.match(/[^.!?]+[.!?]*/g) || [t.text];
    const results = [];
    for (const sentence of sentences) {
      if (sentence.trim().length < 5) continue;
      const output = await xaiClassifier(sentence, candidateLabels, classificationOptions);
      console.log(`Sentence: "${sentence}"`);
      output.labels.forEach((label, idx) => {
        console.log(`  - ${hypothesisMap[label]}: ${output.scores[idx].toFixed(3)}`);
        if (output.scores[idx] > 0.15) results.push({ trigger: hypothesisMap[label], score: output.scores[idx], sentence: sentence.trim() });
      });
    }

    // 3. Global
    const overallOutput = await xaiClassifier(t.text, candidateLabels, classificationOptions);
    console.log(`Global text:`);
    const grouped = {};
    overallOutput.labels.forEach((label, idx) => {
      console.log(`  - ${hypothesisMap[label]}: ${overallOutput.scores[idx].toFixed(3)}`);
      if (overallOutput.scores[idx] > 0.15) grouped[hypothesisMap[label]] = { trigger: hypothesisMap[label], score: overallOutput.scores[idx], sentences: [] };
    });

    for (const r of results) {
      if (!grouped[r.trigger]) grouped[r.trigger] = { trigger: r.trigger, score: r.score, sentences: [r.sentence] };
      else {
        if (!grouped[r.trigger].sentences.includes(r.sentence)) grouped[r.trigger].sentences.push(r.sentence);
        if (r.score > grouped[r.trigger].score) grouped[r.trigger].score = r.score;
      }
    }

    const elapsed = Date.now() - start;
    console.log("XAI Triggers detected:");
    Object.values(grouped).forEach(g => console.log(`  - ${g.trigger} (${(g.score*100).toFixed(1)}%) -> ${g.sentences.length} sentences`));
    console.log(`⏱️ Total time for ${t.name}: ${elapsed}ms`);
  }
}

run();
