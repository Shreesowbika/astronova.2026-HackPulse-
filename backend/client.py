import flwr as fl
import torch
import torch.optim as optim
from collections import OrderedDict
from model import TinyVAE, loss_function

# 1. Simulate Dummy Data (Price, Ship, Rate, Stock)
local_data = torch.tensor([
    [0.5, 0.1, 0.9, 1.0], 
    [0.55, 0.1, 0.8, 1.0], 
    [0.45, 0.2, 0.9, 0.0]
], dtype=torch.float32)

net = TinyVAE()
optimizer = optim.Adam(net.parameters(), lr=1e-3)

class FairMarketClient(fl.client.NumPyClient):
    def get_parameters(self, config):
        # FIX: Manual conversion from PyTorch -> NumPy list
        return [val.cpu().numpy() for _, val in net.state_dict().items()]

    def set_parameters(self, parameters):
        # FIX: Manual conversion from NumPy list -> PyTorch State Dict
        params_dict = zip(net.state_dict().keys(), parameters)
        state_dict = OrderedDict({k: torch.tensor(v) for k, v in params_dict})
        net.load_state_dict(state_dict, strict=True)

    def fit(self, parameters, config):
        self.set_parameters(parameters)
        print("[CLIENT] Training local model on private data...")
        
        net.train()
        for _ in range(5):
            optimizer.zero_grad()
            recon_batch, mu, logvar = net(local_data)
            loss = loss_function(recon_batch, local_data, mu, logvar)
            loss.backward()
            optimizer.step()
            
        # Return simple python types
        return self.get_parameters(config={}), int(len(local_data)), {}

    def evaluate(self, parameters, config):
        self.set_parameters(parameters)
        net.eval()
        with torch.no_grad():
            recon_batch, mu, logvar = net(local_data)
            loss = loss_function(recon_batch, local_data, mu, logvar)
        
        # Return simple python types
        return float(loss.item()), int(len(local_data)), {"accuracy": float(loss.item())}

print("[CLIENT] Connecting to FairMarket Server...")
fl.client.start_numpy_client(server_address="127.0.0.1:8080", client=FairMarketClient())