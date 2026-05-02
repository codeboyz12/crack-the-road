# คู่มือการใช้งานและรายละเอียดของโมเดล AI (Model Usage Manual)

เอกสารนี้อธิบายถึงโมเดล AI ที่ใช้ในโปรเจกต์ ซึ่งอยู่ในรูปแบบ ONNX (`.onnx`) พร้อมกับไฟล์น้ำหนักโมเดล (`.onnx.data`) รวมถึงวิธีการนำไปใช้งานในโค้ด Python ผ่านไลบรารี `onnxruntime`

## 1. ภาพรวมของไฟล์โมเดล (Overview of Model Files)

ในโฟลเดอร์ `model\` จะประกอบไปด้วยไฟล์หลักๆ 4 ไฟล์ ดังนี้:

- **`.onnx` (Open Neural Network Exchange):** เป็นไฟล์ที่เก็บโครงสร้างของโมเดล AI (Architecture) และ Computational Graph ซึ่งสามารถนำไปรันบนแพลตฟอร์มใดก็ได้ที่รองรับ เช่น `onnxruntime`
- **`.onnx.data`:** เป็นไฟล์ที่เก็บข้อมูลค่าน้ำหนัก (Weights / Tensors) ของโมเดลในกรณีที่โมเดลมีขนาดใหญ่เกินกว่าที่ไฟล์ `.onnx` เพียงไฟล์เดียวจะเก็บไว้ได้ตามข้อจำกัดของ Protobuf **ไฟล์นี้จะต้องอยู่คู่กับไฟล์ `.onnx` เสมอ** ระบบ (onnxruntime) จะทำการโหลดข้อมูลจากไฟล์ `.data` โดยอัตโนมัติเมื่อเราสั่งโหลดไฟล์ `.onnx`

---

## 2. รายละเอียดของโมเดลแต่ละตัว

### 2.1 `mobilenet_v2_model.onnx` และ `mobilenet_v2_model.onnx.data`
* **หน้าที่ (Purpose):** เป็นโมเดลหลัก (Main Classifier) แบบ Fine-grained ที่ใช้ในการจำแนกประเภทของความเสียหายบนผิวถนนในระดับละเอียด
* **สถาปัตยกรรม (Architecture):** อิงตามโครงสร้างของ MobileNetV2 ซึ่งเป็นโมเดลที่มีน้ำหนักเบาและทำงานได้รวดเร็ว เหมาะสำหรับการใช้งานแบบ Real-time และการนำไป Deploy 
* **คลาสที่รองรับ (Classes):** จำแนกความเสียหายออกเป็น 4 ประเภทหลัก ได้แก่:
  1. Alligator Crack (รอยร้าวแบบหนังจระเข้) - ความรุนแรงระดับ High
  2. Deep Foundation Consolidation (การทรุดตัวของชั้นพื้นฐาน) - ความรุนแรงระดับ Critical
  3. Pot Hole (หลุมบ่อ) - ความรุนแรงระดับ Critical
  4. Reflection Crack (รอยร้าวสะท้อน) - ความรุนแรงระดับ Medium
* **รูปแบบ Input:** รับรูปภาพขนาด `224x224` พิกเซล, ผ่านการ Normalize ค่าและเรียง Array ในรูปแบบ `CHW` (Channel, Height, Width) พร้อมเพิ่มมิติ Batch
* **รูปแบบ Output:** ค่า Logits ซึ่งต้องนำไปเข้าฟังก์ชัน Softmax เพื่อแปลงเป็นค่าความน่าจะเป็น (Probability) ของแต่ละคลาส

### 2.2 `stage1_3class_classifier.onnx` และ `stage1_3class_classifier.onnx.data`
* **หน้าที่ (Purpose):** เป็นโมเดลคัดกรองด่านแรก (Stage-1 Filter) ในระบบ Two-Stage Classification โมเดลนี้ถูกสร้างขึ้นเพื่อแก้ปัญหาที่โมเดลหลัก (MobileNetV2) มักจะทายผิดพลาด (False Positive) เมื่อได้รับภาพ "ถนนปกติ" หรือภาพที่ไม่มีความเสียหาย
* **คลาสที่รองรับ (Classes):** จำแนกสภาพแวดล้อมกว้างๆ ออกเป็น 3 ประเภท ได้แก่:
  1. Normal Road (ถนนปกติ ไม่มีข้อบกพร่อง)
  2. Damaged Road / Cracks (ถนนที่มีความเสียหายหรือรอยแตก)
  3. Other / Background (อื่นๆ หรือไม่ใช่ภาพพื้นถนน)
*(หมายเหตุ: ชื่อคลาสจริงอาจปรับเปลี่ยนไปตามชุดข้อมูลที่ใช้เทรนโมเดลตัวนี้)*
* **แนวทางการใช้งาน:** เมื่อได้รับรูปภาพเข้าสู่ระบบ โปรแกรมจะส่งให้ `stage1_3class_classifier` ทำการประเมินก่อน หากพบว่าเป็น "ถนนปกติ" โปรแกรมจะสามารถตอบผลลัพธ์กลับไปให้ผู้ใช้งานได้ทันที แต่หากพบว่าเป็น "ถนนที่มีความเสียหาย" โปรแกรมจึงจะส่งภาพนั้นต่อไปยัง `mobilenet_v2_model` เพื่อระบุประเภทความเสียหายเชิงลึกอีกครั้ง

---

## 3. ตัวอย่างโค้ดและวิธีใช้งานโมเดล (Code Example)

ด้านล่างคือตัวอย่างโค้ด Python ในการโหลดโมเดล ONNX และทำการพยากรณ์ (Inference) สำหรับระบบ Two-Stage Pipeline

### ข้อกำหนดเบื้องต้น (Prerequisites)
ทำการติดตั้งไลบรารีที่จำเป็นก่อนใช้งาน:
```bash
pip install onnxruntime numpy pillow
```

### สคริปต์ตัวอย่างการทำงาน (`inference_example.py`)

```python
import onnxruntime as ort
import numpy as np
from PIL import Image

def preprocess_image(image_path: str, target_size=(224, 224)) -> np.ndarray:
    """
    ฟังก์ชันสำหรับเตรียมรูปภาพก่อนเข้าโมเดล
    - โหลดรูปภาพ
    - ปรับขนาด (Resize)
    - Normalize ค่าสีตามมาตรฐาน ImageNet
    """
    # 1. โหลดภาพและแปลงเป็นรูปแบบ RGB
    image = Image.open(image_path).convert("RGB")
    
    # 2. ปรับขนาดภาพให้ตรงกับ Input ที่โมเดลต้องการ
    image = image.resize(target_size)
    
    # 3. แปลงภาพเป็น Numpy Array และสเกลค่าให้อยู่ในช่วง [0, 1]
    img_array = np.array(image, dtype=np.float32) / 255.0
    
    # 4. Normalize ด้วยค่า Mean และ Std (ตามมาตรฐานที่ใช้ Train โมเดลตระกูล MobileNet/ResNet)
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_array = (img_array - mean) / std
    
    # 5. สลับแกนจาก HWC (Height, Width, Channels) เป็น CHW (Channels, Height, Width)
    img_array = np.transpose(img_array, (2, 0, 1))
    
    # 6. เพิ่มมิติ Batch เพื่อให้เป็นโครงสร้างแบบ (B, C, H, W)
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array

def softmax(x):
    """ฟังก์ชันแปลงค่า Logits เป็นค่าความน่าจะเป็น (Probability 0.0 - 1.0)"""
    e_x = np.exp(x - np.max(x))
    return e_x / e_x.sum(axis=1)

def run_inference(model_path: str, image_path: str, class_labels: list):
    """
    ฟังก์ชันสำหรับรันโมเดล ONNX เพื่อทำนายผล
    """
    try:
        # โหลดโมเดล (onnxruntime จะหาไฟล์ .onnx.data ในโฟลเดอร์เดียวกันโดยอัตโนมัติ ไม่ต้องระบุลงไปในโค้ด)
        session = ort.InferenceSession(model_path)
        
        # ดึงชื่อของ Input Layer ของโมเดล
        input_name = session.get_inputs()[0].name
        
        # โหลดและจัดการภาพ
        input_tensor = preprocess_image(image_path)
        
        # รันให้โมเดลทำนาย (Inference)
        outputs = session.run(None, {input_name: input_tensor})
        logits = outputs[0]
        
        # แปลงผลลัพธ์ผ่าน Softmax เพื่อหาค่าความเชื่อมั่น
        probabilities = softmax(logits)[0]
        
        # หา Index ของคลาสที่มีคะแนนความน่าจะเป็นสูงสุด
        top1_index = np.argmax(probabilities)
        confidence = float(probabilities[top1_index])
        
        predicted_class = class_labels[top1_index]
        
        return predicted_class, confidence

    except Exception as e:
        print(f"เกิดข้อผิดพลาดในการรันโมเดล: {e}")
        return None, 0.0

# ==========================================
# ส่วนจำลองการทำงานจริง (Pipeline System)
# ==========================================
if __name__ == "__main__":
    # ใส่พาธของรูปภาพที่ต้องการทดสอบ
    test_image = "test_road_image.jpg" 
    
    # --- 1. นิยามคลาส (Label) ของโมเดลแต่ละสเตจ ---
    STAGE1_CLASSES = ["Normal Road", "Damaged Road", "Other/Obstacle"]
    MOBILENET_CLASSES = [
        "Alligator Crack", 
        "Deep Foundation Consolidation", 
        "Pot Hole", 
        "Reflection Crack"
    ]

    # --- 2. รันโมเดล Stage 1 เพื่อคัดกรองภาพก่อน ---
    print(">>> [Stage 1] กำลังคัดกรองสภาพแวดล้อมเบื้องต้น...")
    stage1_pred, conf1 = run_inference(
        model_path="model/stage1_3class_classifier.onnx", 
        image_path=test_image, 
        class_labels=STAGE1_CLASSES
    )
    
    if stage1_pred:
        print(f"    ผลลัพธ์ Stage 1: {stage1_pred} (ความมั่นใจ: {conf1:.2%})")
        
        # --- 3. หากพบว่าเป็น "ถนนที่มีความเสียหาย" ถึงจะรันโมเดลหลัก (Stage 2) ต่อ ---
        if stage1_pred == "Damaged Road":
            print(">>> [Stage 2] ตรวจพบความเสียหาย! กำลังรันโมเดล MobileNetV2 เพื่อวิเคราะห์ความเสียหายเชิงลึก...")
            final_pred, conf2 = run_inference(
                model_path="model/mobilenet_v2_model.onnx", 
                image_path=test_image, 
                class_labels=MOBILENET_CLASSES
            )
            print(f"    ผลการจำแนกความเสียหายสุทธิ: {final_pred} (ความมั่นใจ: {conf2:.2%})")
        else:
            print(">>> [สรุปผล] ถนนมีสภาพปกติ หรือไม่ใช่ภาพผิวถนน ไม่จำเป็นต้องวิเคราะห์รอยร้าวต่อ")

```

## สรุป (Key Takeaways)
1. การแยกไฟล์เป็น `.onnx` และ `.onnx.data` เป็นกลไกมาตรฐานของ ONNX เพื่อรองรับโมเดลขนาดใหญ่ ในการใช้งานจริงคุณ**อ้างอิงชื่อแค่ไฟล์ `.onnx` เท่านั้น** `onnxruntime` จะจัดการที่เหลือเอง
2. สถาปัตยกรรมที่ออกแบบไว้คือการทำงานร่วมกันแบบ **Two-Stage Classifier Pipeline** ซึ่งเป็นการแก้จุดอ่อนของ MobileNetV2 ที่อาจจะจำแนกภาพถนนปกติผิดพลาดเป็นรอยร้าวได้ การมี Stage 1 มาช่วยกรองจะทำให้ระบบมีความแม่นยำสูงขึ้นและลดปัญหา False Positive อย่างมีนัยสำคัญ
