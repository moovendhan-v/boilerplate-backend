import { Request, Response } from 'express';
import { BoilerplateService } from '../services/boilerplate.service';

export class BoilerplateController {
  private boilerplateService: BoilerplateService;

  constructor() {
    this.boilerplateService = new BoilerplateService();
  }

  async getBoilerplate(req: Request, res: Response) {
    try {
      const boilerplateId = req.params.id;
      const boilerplate = await this.boilerplateService.findBoilerplateById(boilerplateId);
      if (!boilerplate) {
        return res.status(404).json({ message: 'Boilerplate not found' });
      }
      res.json(boilerplate);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  async listBoilerplates(req: Request, res: Response) {
    try {
      const { skip, take, where, orderBy } = req.query;
      const boilerplates = await this.boilerplateService.findBoilerplates({
        skip: skip ? parseInt(skip as string) : undefined,
        take: take ? parseInt(take as string) : undefined,
        where: where ? JSON.parse(where as string) : undefined,
        orderBy: orderBy ? JSON.parse(orderBy as string) : undefined
      });
      res.json(boilerplates);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  async createBoilerplate(req: Request, res: Response) {
    try {
      const boilerplateData = req.body;
      const boilerplate = await this.boilerplateService.createBoilerplate(boilerplateData);
      res.status(201).json(boilerplate);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  async updateBoilerplate(req: Request, res: Response) {
    try {
      const boilerplateId = req.params.id;
      const updateData = req.body;
      const boilerplate = await this.boilerplateService.updateBoilerplate(boilerplateId, updateData);
      res.json(boilerplate);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  async deleteBoilerplate(req: Request, res: Response) {
    try {
      const boilerplateId = req.params.id;
      await this.boilerplateService.deleteBoilerplate(boilerplateId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}