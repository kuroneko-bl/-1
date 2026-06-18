const mongoose = require('mongoose');

const ContractSchema = new mongoose.Schema({
  exhibitionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Exhibition', 
    required: true 
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  buyer: {
    type: String,
    required: true,
    trim: true
  },
  seller: {
    type: String,
    required: true,
    trim: true
  },
  product: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  amount: {
    type: Number,
    default: 0,
    min: 0
  },
  contractNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  signedAt: { 
    type: Date, 
    default: Date.now 
  }
});

ContractSchema.pre('save', async function(next) {
  if (!this.contractNumber) {
    const year = new Date().getFullYear();
    
    const lastContract = await mongoose.model('Contract')
      .findOne({ contractNumber: new RegExp('^K-' + year + '-') })
      .sort({ contractNumber: -1 });
    
    let nextNumber = 1;
    if (lastContract) {
      const parts = lastContract.contractNumber.split('-');
      if (parts.length === 3) {
        const lastNum = parseInt(parts[2]);
        if (!isNaN(lastNum)) {
          nextNumber = lastNum + 1;
        }
      }
    }
    
    this.contractNumber = 'K-' + year + '-' + String(nextNumber).padStart(4, '0');
  }
  next();
});

module.exports = mongoose.model('Contract', ContractSchema);