# İmam AI Ekranı

İmam AI ekranı, kullanıcıların dini sorularını ChatGPT AI modeline sorabilecekleri bir arayüz sunar.

## Özellikler

- OpenAI GPT-4o modelini kullanarak dini sorulara yanıt verir
- Kullanıcı profiline (mezhep, yaş, cinsiyet) göre özelleştirilmiş yanıtlar sunar
- Soru-cevap sohbet arayüzü
- Kullanıcı bilgilerine göre kişiselleştirilmiş karşılama mesajları

## Kurulum

1. `src/config/env.example.ts` dosyasını `src/config/env.ts` olarak kopyalayın
2. `env.ts` dosyası içinde `OPENAI_API_KEY` değerini kendi OpenAI API anahtarınızla güncelleyin

## Kullanım

Kullanıcılar dini sorularını metin kutusuna yazıp gönderebilirler. AI hemen yanıt verecektir.

## Teknik Detaylar

- OpenAI API'ye istek atmadan önce kullanıcı profilinden alınan bilgilerle sistem mesajı oluşturulur
- Few-shot örnekleri kullanılarak AI'nın yanıt kalitesi artırılır
- Mezhep özelleştirmesi sayesinde farklı mezheplere uygun yanıtlar verilir
- Kullanıcı yaşına göre yanıt karmaşıklığı ayarlanır

## Uyarılar

- API anahtarını güvenli bir şekilde saklayın
- `env.ts` dosyasını asla git'e commit etmeyin (bu dosya .gitignore'a eklenmiştir)
- Yüksek trafik durumunda API kullanım limitlerini kontrol edin 