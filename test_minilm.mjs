import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;

async function run() {
  const start = Date.now();
  console.log("Loading model...");
  const classifier = await pipeline('zero-shot-classification', 'onnx-community/multilingual-MiniLMv2-L6-mnli-xnli-ONNX', { quantized: true });
  console.log("Model loaded in", Date.now() - start, "ms");

  const sentences = [
    "Ваш обліковий запис буде заблоковано протягом 24 годин через підозрілу активність.",
    "Щоб уникнути блокування, необхідно терміново підтвердити дані облікового запису.",
    "Перейдіть за посиланням нижче та виконайте перевірку:",
    "Якщо підтвердження не буде виконано сьогодні, доступ до облікового запису може бути обмежено."
  ];

  const labels = [
      'терміновість',
      'авторитет',
      'фінансова маніпуляція',
      'шантаж',
      'викрадення даних',
      'унікальна можливість',
      'прохання про допомогу'
  ];

  const infStart = Date.now();
  for (const s of sentences) {
    await classifier(s, labels, { multi_label: true });
  }
  console.log("Inference (28 passes) took", Date.now() - infStart, "ms");
}

run();
