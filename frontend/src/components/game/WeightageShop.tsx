import { SHOP_ITEMS } from '../../types';
import { Badge } from '../ui/Badge';

interface WeightageShopProps {
  roomId: string;
}

export function WeightageShop({ roomId: _roomId }: WeightageShopProps) {
  async function handleBuy(itemId: string) {
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return;

    // Razorpay integration placeholder
    // In production, create order via API, then open Razorpay checkout
    console.log('Buy item:', item);
  }

  return (
    <div className="bg-surface2 rounded-xl border border-white/[0.07] p-4">
      <h3 className="font-syne font-semibold text-sm mb-3">Weightage Shop</h3>
      <div className="space-y-3">
        {SHOP_ITEMS.map((item) => (
          <div
            key={item.id}
            className="bg-surface3 rounded-lg p-3 border border-white/[0.07]"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{item.label}</span>
              <Badge variant="gold">+{item.extra_weightage}</Badge>
            </div>
            <p className="text-xs text-white/40 mb-2">{item.description}</p>
            <button
              onClick={() => handleBuy(item.id)}
              className="w-full py-1.5 bg-gold/10 text-gold text-xs font-semibold rounded-lg border border-gold/20 hover:bg-gold/20 transition"
            >
              Buy for Rs.{item.price_inr}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
