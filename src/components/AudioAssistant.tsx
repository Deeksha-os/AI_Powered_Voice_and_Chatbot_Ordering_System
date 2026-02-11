import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useToast } from '@/hooks/use-toast';

interface AudioAssistantProps {
  onAddToCart: (productId: number) => void;
  onBulkAddToCart: (items: Array<{productId: number, quantity: number}>) => void;
  products: Array<{
    id: number;
    name: string;
    price: number;
    unit: string;
    category: string;
    stock: number;
    image: string;
  }>;
}

export const AudioAssistant = ({ onAddToCart, onBulkAddToCart, products }: AudioAssistantProps) => {
  const [chatInput, setChatInput] = useState('');
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const { toast } = useToast();

  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // Text-to-speech functionality
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  const handleVoiceCommand = (command: string) => {
    const lowerCommand = command.toLowerCase();
    let itemsToAdd: Array<{productId: number, quantity: number}> = [];

    // Treat common adjectives as stop-words so they don't match multiple items
    const STOP_WORDS = new Set([
      'fresh','organic','whole','sweet','some','add','get','need','want','please','a','an','the','and','kg','dozen','cup','cups','litre','liter','per'
    ]);

    // Basic singularization for simple English plurals
    const singularize = (w: string) => {
      if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
      if (w.endsWith('es')) return w.slice(0, -2);
      if (w.endsWith('s') && w.length > 3) return w.slice(0, -1);
      return w;
    };

    const tokenize = (text: string) => text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .map(singularize)
      .filter(t => t && !STOP_WORDS.has(t));

    const queryTokens = new Set(tokenize(lowerCommand));

    // Enhanced parsing for multiple items
    const parseMultipleItems = (command: string) => {
      const items: Array<{productId: number, quantity: number}> = [];
      
      // Split by common separators
      const separators = [' and ', ', ', ' plus ', ' with '];
      let parts = [command];
      
      for (const sep of separators) {
        const newParts: string[] = [];
        for (const part of parts) {
          newParts.push(...part.split(sep));
        }
        parts = newParts;
      }

      // Process each part
      for (const part of parts) {
        const trimmedPart = part.trim();
        if (!trimmedPart) continue;

        const partTokens = new Set(tokenize(trimmedPart));
        
        // Enhanced quantity detection - look for numbers and quantity words
        let quantity = 1;
        
        // First check for numeric quantities (e.g., "2 apples", "three bananas")
        const numericMatch = trimmedPart.match(/(\d+)\s+/);
        if (numericMatch) {
          quantity = parseInt(numericMatch[1]);
        } else {
          // Check for word-based quantities
          const quantityWords = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
          const quantityMap: Record<string, number> = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
          };
          
          for (const word of quantityWords) {
            if (partTokens.has(word)) {
              quantity = quantityMap[word];
              break;
            }
          }
        }

        // Remove quantity words from tokens to avoid matching them as product names
        const quantityWords = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
        quantityWords.forEach(word => partTokens.delete(word));
        
        // Also remove numeric tokens
        const numericTokens = Array.from(partTokens).filter(token => /^\d+$/.test(token));
        numericTokens.forEach(token => partTokens.delete(token));

        // Find matching product
        const scored: Array<{ productId: number; score: number }> = products.map(p => {
          const nameTokens = new Set(tokenize(p.name));
          let score = 0;
          nameTokens.forEach(t => { if (partTokens.has(t)) score += 1; });
          return { productId: p.id, score };
        });

        const best = scored.sort((a,b) => b.score - a.score)[0];
        if (best && best.score > 0) {
          items.push({ productId: best.productId, quantity });
        }
      }

      return items;
    };

    // Try to parse multiple items first
    let multipleItems = parseMultipleItems(command);
    // Enforce maximum of 15 list items
    if (multipleItems.length > 15) {
      toast({ title: "Too many items", description: "Added first 15 items from your request." });
      multipleItems = multipleItems.slice(0, 15);
    }
    
    if (multipleItems.length > 1) {
      // Use bulk add for multiple items
      onBulkAddToCart(multipleItems);
      const itemDetails = multipleItems.map(item => {
        const product = products.find(p => p.id === item.productId);
        return `${item.quantity} ${product?.name || 'item'}`;
      }).join(', ');
      const response = `Added ${itemDetails} to your cart!`;
      speak(response);
      toast({ title: "Multiple Items Added", description: response });
      return;
    } else if (multipleItems.length === 1) {
      // Single item with quantity - use bulk add for consistency
      onBulkAddToCart(multipleItems);
      const item = multipleItems[0];
      const product = products.find(p => p.id === item.productId);
      const response = `Added ${item.quantity} ${product?.name || 'item'} to your cart!`;
      speak(response);
      toast({ title: "Item Added", description: response });
      return;
    }

    // Fallback to single item logic for backward compatibility
    const categoryIntent = ['vegetable','fruit','dairy','staple','rice','flour','milk','yogurt','banana','apple','tomato','spinach'];
    const hasCategoryOnlyIntent = categoryIntent.some(c => queryTokens.has(c)) && queryTokens.size <= 2;

    // Score products by token overlap (excluding stop-words). Prefer highest score.
    type Scored = { productId: number; score: number };
    const scored: Scored[] = products.map(p => {
      const nameTokens = new Set(tokenize(p.name));
      let score = 0;
      nameTokens.forEach(t => { if (queryTokens.has(t)) score += 1; });
      return { productId: p.id, score };
    });

    // If there is a specific item token match, add only the best-matching product
    const best = scored.sort((a,b) => b.score - a.score)[0];
    if (best && best.score > 0) {
      const prod = products.find(p => p.id === best.productId);
      if (prod) {
        onAddToCart(prod.id);
        const response = `Added ${prod.name} to your cart!`;
        speak(response);
        toast({ title: "Item Added", description: response });
        return;
      }
    } else if (hasCategoryOnlyIntent) {
      // If only generic category words spoken, add one representative item of that category
      const categoryMap: Record<string,string> = { vegetable:'vegetables', fruit:'fruits', dairy:'dairy', staple:'staples' };
      const targetCat = Object.keys(categoryMap).find(k => queryTokens.has(k));
      if (targetCat) {
        const catKey = categoryMap[targetCat];
        const prod = products.find(p => p.category?.toLowerCase() === catKey);
        if (prod) {
          onAddToCart(prod.id);
          const response = `Added ${prod.name} to your cart!`;
          speak(response);
          toast({ title: "Category Item Added", description: response });
          return;
        }
      }
    }

    // No items found
    const response = "Sorry, those products are not available. Please try specific names.";
    speak(response);
    toast({ title: "Items Not Found", description: response, variant: "destructive" });

    // Build recommendations for known keywords
    const SUGGESTION_MAP: Record<string, string[]> = {
      banana: ["Kashmir Banana", "Kerala Banana", "Sweet Banana"],
      bananas: ["Kashmir Banana", "Kerala Banana", "Sweet Banana"],
      apple: ["Kashmir Apple", "Fuji Apple", "Fresh Apples"],
      apples: ["Kashmir Apple", "Fuji Apple", "Fresh Apples"],
    };
    const recs: string[] = [];
    Object.keys(SUGGESTION_MAP).forEach(key => {
      if (lowerCommand.includes(key)) {
        recs.push(...SUGGESTION_MAP[key]);
      }
    });
    if (recs.length > 0) {
      setRecommendations(recs);
      speak(`You may also like ${recs.join(', ')}`);
    } else {
      setRecommendations([]);
    }
  };

  const handleChatSubmit = () => {
    const textToProcess = transcript || chatInput;
    if (!textToProcess.trim()) return;

    handleVoiceCommand(textToProcess);
    setChatInput('');
    resetTranscript();
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
      if (transcript) {
        handleVoiceCommand(transcript);
      }
    } else {
      startListening();
      speak("Listening for your grocery order...");
    }
  };

  const addSuggested = (label: string) => {
    const target = products.find(p => p.name.toLowerCase().includes(label.toLowerCase().split(' ')[0]) || label.toLowerCase().includes(p.name.toLowerCase()));
    // Fallback: map banana variants to Sweet Bananas if present
    const fallback = products.find(p => p.name.toLowerCase().includes('banana'));
    const prod = target || fallback;
    if (prod) {
      onAddToCart(prod.id);
      toast({ title: "Added", description: `${label} added (closest match)` });
    } else {
      toast({ title: "Not available", description: `${label} is not in catalog`, variant: "destructive" });
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Voice Shopping Assistant
        </CardTitle>
        <CardDescription>
          Speak your grocery list or type to add items: "vegetables, fruits, dairy"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voice Control */}
        {browserSupportsSpeechRecognition && (
          <div className="flex items-center gap-2">
            <Button
              variant={isListening ? "destructive" : "outline"}
              onClick={toggleListening}
              className="flex items-center gap-2"
            >
              {isListening ? (
                <>
                  <MicOff className="h-4 w-4" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Start Voice Order
                </>
              )}
            </Button>
            {isListening && (
              <Badge variant="secondary" className="animate-pulse">
                Listening...
              </Badge>
            )}
          </div>
        )}

        {/* Live transcript display */}
        {transcript && (
          <div className="p-3 bg-secondary/50 rounded-lg">
            <p className="text-sm font-medium">You said:</p>
            <p className="text-sm">{transcript}</p>
          </div>
        )}

        {/* Text input fallback */}
        <div className="flex space-x-2">
          <Input
            placeholder="Or type your grocery list here..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
          />
          <Button onClick={handleChatSubmit}>Add to Cart</Button>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Recommended products</div>
            <div className="flex flex-wrap gap-2">
              {recommendations.map((rec, idx) => (
                <Button key={idx} variant="outline" size="sm" onClick={() => addSuggested(rec)}>
                  {rec}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Voice instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Voice commands:</strong></p>
          <p>• "Add 2 tomatoes and 3 bananas" - Adds multiple items with quantities</p>
          <p>• "I need five apples, two milk" - Adds items with word quantities</p>
          <p>• "Get 3 vegetables and 2 fruits" - Adds items from categories with quantities</p>
          <p>• "Add rice, 4 flour, and milk" - Mix of items with and without quantities</p>
          <p>• "I need dairy products" - Adds representative dairy item</p>
        </div>
      </CardContent>
    </Card>
  );
};