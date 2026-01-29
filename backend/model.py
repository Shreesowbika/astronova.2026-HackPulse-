import torch
import torch.nn as nn
import torch.nn.functional as F

class TinyVAE(nn.Module):
    def __init__(self, input_dim=4):
        super(TinyVAE, self).__init__()
        self.fc1 = nn.Linear(input_dim, 3)
        self.fc2_mean = nn.Linear(3, 2)
        self.fc2_logvar = nn.Linear(3, 2)
        self.fc3 = nn.Linear(2, 3)
        self.fc4 = nn.Linear(3, input_dim)

    def encode(self, x):
        h1 = F.relu(self.fc1(x))
        return self.fc2_mean(h1), self.fc2_logvar(h1)

    def reparameterize(self, mu, logvar):
        std = torch.exp(0.5*logvar)
        eps = torch.randn_like(std)
        return mu + eps*std

    def decode(self, z):
        h3 = F.relu(self.fc3(z))
        return torch.sigmoid(self.fc4(h3))

    def forward(self, x):
        mu, logvar = self.encode(x)
        z = self.reparameterize(mu, logvar)
        return self.decode(z), mu, logvar

def loss_function(recon_x, x, mu, logvar):
    BCE = F.binary_cross_entropy(recon_x, x, reduction='sum')
    KLD = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
    return BCE + KLD