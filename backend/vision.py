import open_clip
import torch
from PIL import Image
import io
import logging

logger = logging.getLogger("uvicorn")

class VisionEngine:
    def __init__(self):
        self.model = None
        self.preprocess = None

    def load_model(self):
        if self.model is None:
            logger.info("Chargement du modèle OpenCLIP ViT-B/32 en mémoire RAM...")
            self.model, _, self.preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
            self.model.eval()
            logger.info("OpenCLIP prêt pour l'inférence en temps réel.")

    def warmup(self):
        """Précharge le modèle et exécute un faux passage pour initialiser PyTorch."""
        self.load_model()
        # Passage d'une image vierge 224x224 pour chauffer le graphe de calcul
        dummy_image = Image.new('RGB', (224, 224), color='white')
        image_input = self.preprocess(dummy_image).unsqueeze(0)
        with torch.no_grad():
            self.model.encode_image(image_input)
        logger.info("Warmup OpenCLIP achevé avec succès.")

    def extract_image_embedding(self, image_bytes: bytes) -> list:
        self.load_model()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_input = self.preprocess(image).unsqueeze(0)
        
        with torch.no_grad():
            image_features = self.model.encode_image(image_input)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            
        return image_features.cpu().numpy().flatten().tolist()

    def extract_text_embedding(self, text: str) -> list:
        """Embedding texte OpenCLIP (même espace 512-d que les images indexées)."""
        self.load_model()
        tokenizer = open_clip.get_tokenizer("ViT-B-32")
        tokens = tokenizer([text[:300]])
        with torch.no_grad():
            text_features = self.model.encode_text(tokens)
            text_features /= text_features.norm(dim=-1, keepdim=True)
        return text_features.cpu().numpy().flatten().tolist()

vision_engine = VisionEngine()

def get_vision_engine():
    return vision_engine
